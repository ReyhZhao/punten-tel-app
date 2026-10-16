import Foundation
import Observation
import os
import PuntentellerKit

/// Houdt `AppData` bij en bewaart die na elke wijziging als JSON in Application
/// Support. De logica zelf zit in PuntentellerKit.
@MainActor @Observable
final class GameStore {
    private(set) var data: AppData
    @ObservationIgnored private let fileURL: URL?
    @ObservationIgnored private let log = Logger(subsystem: "online.vels.puntenteller", category: "GameStore")

    /// - Parameter fileURL: nil = alleen in het geheugen (previews).
    init(fileURL: URL? = GameStore.defaultFileURL, data: AppData? = nil) {
        self.fileURL = fileURL
        if let data {
            self.data = data
        } else if let fileURL, let raw = try? Data(contentsOf: fileURL) {
            do {
                self.data = try JSONDecoder.puntenteller.decode(AppData.self, from: raw)
            } catch {
                Logger(subsystem: "online.vels.puntenteller", category: "GameStore")
                    .error("Kon opslag niet lezen: \(error.localizedDescription)")
                self.data = AppData()
            }
        } else {
            self.data = AppData()
        }
    }

    static var defaultFileURL: URL {
        URL.applicationSupportDirectory.appending(path: "puntenteller.json")
    }

    var games: [Game] { data.visibleGames }

    func game(_ id: UUID) -> Game? { data.game(id) }

    @discardableResult
    func startGame(name: String, rules: GameRules, playerNames: [String], profileId: UUID? = nil) -> Game {
        let game = data.startGame(name: name, rules: rules, playerNames: playerNames, profileId: profileId)
        save()
        return game
    }

    @discardableResult
    func applyScore(_ delta: Int, to playerId: UUID, in gameId: UUID) -> ScoreOutcome {
        let outcome = data.updateGame(gameId) { $0.applyScore(delta, to: playerId) } ?? .ignored
        save()
        return outcome
    }

    func undo(entryId: UUID, in gameId: UUID) {
        data.updateGame(gameId) { $0.undo(entryId: entryId) }
        save()
    }

    func finish(_ gameId: UUID) {
        data.updateGame(gameId) { $0.finish() }
        save()
    }

    func delete(_ gameId: UUID) {
        data.updateGame(gameId) { $0.markDeleted() }
        save()
    }

    func resetScores(_ gameId: UUID) {
        data.updateGame(gameId) { $0.resetScores() }
        save()
    }

    /// Nieuw spel met dezelfde spelregels en spelers; het oude blijft bewaard.
    func rematch(_ gameId: UUID) -> Game? {
        let next = data.rematch(gameId)
        save()
        return next
    }

    var profiles: [GameProfile] { data.visibleProfiles }
    var savedPlayers: [SavedPlayer] { data.savedPlayers }

    func profile(named name: String) -> GameProfile? { data.profile(named: name) }

    @discardableResult
    func saveProfile(name: String, rules: GameRules) -> GameProfile {
        let profile = data.saveProfile(name: name, rules: rules)
        save()
        return profile
    }

    func leaderboard(profileId: UUID?) -> [(player: SavedPlayer, wins: Int)] {
        Statistics.leaderboard(data.savedPlayers, in: data.games, profileId: profileId)
    }

    /// Importeert een export van de web-app. Werkt met bestanden uit de
    /// bestandskiezer (security-scoped) en uit het deelmenu ("Open in").
    func importPWAExport(from url: URL) throws -> PWAImportSummary {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let json = try Data(contentsOf: url)
        let summary = try data.importPWAExport(json)
        save()
        return summary
    }

    private func save() {
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder.puntenteller.encode(data).write(to: fileURL, options: .atomic)
        } catch {
            log.error("Kon opslag niet schrijven: \(error.localizedDescription)")
        }
    }
}

extension GameStore {
    /// Store met voorbeeldspellen, voor previews.
    static var preview: GameStore {
        var data = AppData()
        var g = data.startGame(name: "Rummikub", rules: GameRules(), playerNames: ["Anna", "Bram", "Cas"])
        g.applyScore(12, to: g.players[0].id)
        g.applyScore(30, to: g.players[1].id)
        data.updateGame(g.id) { $0 = g }
        data.startGame(name: "Yahtzee", rules: GameRules(scoring: .low), playerNames: ["Dirk", "Eva"])
        return GameStore(fileURL: nil, data: data)
    }
}
