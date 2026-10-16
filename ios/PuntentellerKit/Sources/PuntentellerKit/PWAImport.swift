import CryptoKit
import Foundation

// Import van de data uit de PWA (frontend/src/exportData.ts). Zet het PWA-model
// (localStorage-key `pwa-punten-v2`, zie frontend/src/types.ts) om naar het
// sync-klare model uit ADR-0002.
//
// Opnieuw importeren is veilig: id's worden deterministisch afgeleid van de
// PWA-id's, dus hetzelfde spel komt niet dubbel binnen. Een spel wordt alleen
// vervangen als de PWA-versie nieuwer is.

public struct PWAImportSummary: Equatable, Sendable {
    public var gamesAdded = 0
    public var gamesUpdated = 0
    public var gamesUnchanged = 0
    public var profilesAdded = 0
    public var playersAdded = 0
    /// Spelers waarvan de opgeslagen PWA-score niet klopte met het logboek;
    /// het verschil is als correctieboeking toegevoegd.
    public var scoreCorrections = 0

    public var isEmpty: Bool { gamesAdded + gamesUpdated + gamesUnchanged + profilesAdded + playersAdded == 0 }

    public init(
        gamesAdded: Int = 0,
        gamesUpdated: Int = 0,
        gamesUnchanged: Int = 0,
        profilesAdded: Int = 0,
        playersAdded: Int = 0,
        scoreCorrections: Int = 0
    ) {
        self.gamesAdded = gamesAdded
        self.gamesUpdated = gamesUpdated
        self.gamesUnchanged = gamesUnchanged
        self.profilesAdded = profilesAdded
        self.playersAdded = playersAdded
        self.scoreCorrections = scoreCorrections
    }
}

public enum PWAImportError: LocalizedError, Equatable {
    case notAnExport
    case unsupportedVersion(Int)

    public var errorDescription: String? {
        switch self {
        case .notAnExport:
            "Dit bestand is geen export van de Puntenteller-webapp."
        case .unsupportedVersion(let v):
            "Deze export (versie \(v)) is te nieuw voor deze versie van de app. Werk de app bij en probeer het opnieuw."
        }
    }
}

extension AppData {
    public static let pwaExportFormat = "puntenteller-pwa-export"

    /// Importeert een PWA-export (of de ruwe localStorage-JSON) in deze data.
    @discardableResult
    public mutating func importPWAExport(_ json: Data, at now: Date = .now) throws -> PWAImportSummary {
        let state = try PWA.decode(json)
        var summary = PWAImportSummary()

        // 1. Spelprofielen
        for p in state.gameProfiles ?? [] where p.deletedAt == nil {
            let id = PWA.id("profile", p.id)
            guard !gameProfiles.contains(where: { $0.id == id }) else { continue }
            gameProfiles.append(GameProfile(id: id, name: p.name, rules: p.rules, updatedAt: now))
            markDirty(profile: id)
            summary.profilesAdded += 1
        }

        // 2. Bewaarde spelers (op naam gekoppeld aan wie er al is)
        for sp in state.savedPlayers ?? [] {
            if savedPlayer(named: sp.name) == nil {
                savedPlayers.append(SavedPlayer(
                    id: PWA.id("saved", sp.id), name: sp.name, color: sp.color, accountId: sp.accountId, updatedAt: now
                ))
                summary.playersAdded += 1
            }
        }

        // 3. Spellen (verwijderde spellen uit de PWA niet)
        for pg in state.games ?? [] where pg.deletedAt == nil {
            var (game, corrections) = pg.toGame()
            for i in game.players.indices {
                let name = game.players[i].name
                if let saved = savedPlayer(named: name) {
                    game.players[i].savedPlayerId = saved.id
                } else {
                    let saved = SavedPlayer(name: name, color: game.players[i].color, updatedAt: now)
                    savedPlayers.append(saved)
                    game.players[i].savedPlayerId = saved.id
                    summary.playersAdded += 1
                }
            }
            if let i = games.firstIndex(where: { $0.id == game.id }) {
                // Vergelijk op milliseconden: opgeslagen tijden gaan via ISO-8601
                // met ms-precisie, en kunnen daardoor een fractie afwijken.
                if PWA.milliseconds(game.updatedAt) > PWA.milliseconds(games[i].updatedAt) {
                    games[i] = game
                    markDirty(game: game.id)
                    summary.gamesUpdated += 1
                    summary.scoreCorrections += corrections
                } else {
                    summary.gamesUnchanged += 1
                }
            } else {
                games.append(game)
                markDirty(game: game.id)
                summary.gamesAdded += 1
                summary.scoreCorrections += corrections
            }
        }

        // 4. Overwinningen. De PWA telt die als teller, ook voor spellen die
        //    niet meer bestaan. Wat niet uit de geïmporteerde spellen af te
        //    leiden is, bewaren we apart. Overschrijven (niet optellen), zodat
        //    opnieuw importeren niets verdubbelt.
        let importedIds = Set((state.games ?? []).map { PWA.id("game", $0.id) })
        let importedGames = games.filter { importedIds.contains($0.id) }
        for sp in state.savedPlayers ?? [] {
            guard let i = savedPlayers.firstIndex(where: { $0.name.caseInsensitiveCompare(sp.name) == .orderedSame }) else { continue }
            var base = savedPlayers[i]
            base.importedWins = 0
            base.importedProfileWins = [:]
            let derived = Statistics.wins(of: base, in: importedGames)
            savedPlayers[i].importedWins = max(0, (sp.wins ?? 0) - derived)
            var perProfile: [String: Int] = [:]
            for (pwaProfileId, wins) in sp.profileWins ?? [:] {
                let profileId = PWA.id("profile", pwaProfileId)
                let rest = wins - Statistics.wins(of: base, in: importedGames, profileId: profileId)
                if rest > 0 { perProfile[profileId.uuidString] = rest }
            }
            savedPlayers[i].importedProfileWins = perProfile
        }

        return summary
    }

    private func savedPlayer(named name: String) -> SavedPlayer? {
        savedPlayers.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }
    }
}

// MARK: - PWA-formaat

/// Het model zoals de PWA het opslaat. Velden die in oudere versies ontbraken zijn optioneel.
enum PWA {
    struct Envelope: Decodable {
        let format: String
        let version: Int
        let data: State
    }

    struct State: Decodable {
        let games: [Game]?
        let savedPlayers: [SavedPlayer]?
        let gameProfiles: [Profile]?
    }

    struct Player: Decodable {
        let id: String
        let name: String
        let color: String
        let score: Int
        let accountId: String?
    }

    struct LogEntry: Decodable {
        let id: String
        let playerId: String
        let delta: Int
        let ts: Double
        /// Sinds de sync-versie van de PWA: ingetrokken boekingen blijven als tombstone.
        let undoneAt: Double?
    }

    struct Game: Decodable {
        let id: String
        let name: String
        let profileId: String?
        let scoring: String?
        let timerOn: Bool?
        let timerSecs: Int?
        let maxScore: Int?
        let maxRounds: Int?
        let endMode: String?
        let finishRound: Bool?
        let endTurnsLeft: Int?
        let sortPlayers: Bool?
        let players: [Player]
        let log: [LogEntry]?
        let createdAt: Double
        let lastPlayed: Double?
        let finished: Bool?
        let ownerId: String?
        let participantsCanScore: Bool?
        let deletedAt: Double?

        var rules: GameRules {
            GameRules(
                scoring: Scoring(rawValue: scoring ?? "") ?? .high,
                timerOn: timerOn ?? false,
                timerSecs: timerSecs ?? 60,
                maxScore: maxScore,
                maxRounds: maxRounds,
                endMode: PWA.endMode(endMode, finishRound: finishRound),
                sortPlayers: sortPlayers ?? false
            )
        }

        /// Zet om naar het iOS-model. Geeft ook het aantal correctieboekingen terug.
        func toGame() -> (PuntentellerKit.Game, Int) {
            let gameKey = id
            let created = PWA.date(createdAt)
            let lastPlayed = lastPlayed.map(PWA.date) ?? created
            let playerIds = Dictionary(
                players.map { ($0.id, PWA.id("player", $0.id, scope: gameKey)) }, uniquingKeysWith: { a, _ in a }
            )

            let newPlayers = players.map {
                PuntentellerKit.Player(
                    id: playerIds[$0.id]!, name: $0.name, color: $0.color,
                    accountId: $0.accountId?.lowercased(), updatedAt: lastPlayed
                )
            }
            var entries: [ScoreEntry] = (log ?? []).compactMap { e in
                guard let pid = playerIds[e.playerId] else { return nil }
                return ScoreEntry(
                    id: PWA.id("entry", e.id, scope: gameKey), playerId: pid, delta: e.delta,
                    createdAt: PWA.date(e.ts), undoneAt: e.undoneAt.map(PWA.date)
                )
            }

            // In de PWA staat de score los van het logboek opgeslagen. Klopt de
            // som niet, dan voegen we het verschil toe zodat de stand gelijk blijft.
            var corrections = 0
            for p in players {
                let pid = playerIds[p.id]!
                let sum = entries.reduce(0) { $1.isActive && $1.playerId == pid ? $0 + $1.delta : $0 }
                if sum != p.score {
                    entries.insert(
                        ScoreEntry(id: PWA.uuid("correction", "\(gameKey):\(p.id)"), playerId: pid, delta: p.score - sum, createdAt: created),
                        at: 0
                    )
                    corrections += 1
                }
            }

            let game = PuntentellerKit.Game(
                id: PWA.id("game", gameKey),
                name: name,
                profileId: profileId.map { PWA.id("profile", $0) },
                rules: rules,
                players: newPlayers,
                log: entries,
                endTurnsLeft: (finished ?? false) ? nil : endTurnsLeft,
                createdAt: created,
                updatedAt: lastPlayed,
                finishedAt: (finished ?? false) ? lastPlayed : nil,
                ownerId: ownerId?.lowercased(),
                participantsCanScore: participantsCanScore ?? false
            )
            return (game, corrections)
        }
    }

    struct Profile: Decodable {
        let id: String
        let name: String
        let scoring: String?
        let timerOn: Bool?
        let timerSecs: Int?
        let maxScore: Int?
        let maxRounds: Int?
        let endMode: String?
        let finishRound: Bool?
        let sortPlayers: Bool?
        let deletedAt: Double?

        var rules: GameRules {
            GameRules(
                scoring: Scoring(rawValue: scoring ?? "") ?? .high,
                timerOn: timerOn ?? false,
                timerSecs: timerSecs ?? 60,
                maxScore: maxScore,
                maxRounds: maxRounds,
                endMode: PWA.endMode(endMode, finishRound: finishRound),
                sortPlayers: sortPlayers ?? false
            )
        }
    }

    struct SavedPlayer: Decodable {
        let id: String
        let name: String
        let color: String
        let wins: Int?
        let profileWins: [String: Int]?
        let accountId: String?
    }

    static let supportedVersion = 1

    static func decode(_ json: Data) throws -> State {
        let decoder = JSONDecoder()
        if let envelope = try? decoder.decode(Envelope.self, from: json), envelope.format == AppData.pwaExportFormat {
            guard envelope.version <= supportedVersion else { throw PWAImportError.unsupportedVersion(envelope.version) }
            return envelope.data
        }
        // Een export met een nieuwere versie, waarvan `data` niet meer past.
        struct Header: Decodable { let format: String; let version: Int }
        if let header = try? decoder.decode(Header.self, from: json), header.format == AppData.pwaExportFormat,
           header.version > supportedVersion {
            throw PWAImportError.unsupportedVersion(header.version)
        }
        // Ruwe localStorage-inhoud (bv. handmatig gekopieerd).
        if let state = try? decoder.decode(State.self, from: json), state.games != nil {
            return state
        }
        throw PWAImportError.notAnExport
    }

    /// Oude opslag gebruikte een boolean `finishRound` (zie `migrateEndMode` in store.ts).
    static func endMode(_ raw: String?, finishRound: Bool?) -> EndMode {
        EndMode(rawValue: raw ?? "") ?? ((finishRound ?? false) ? .round : .immediate)
    }

    static func date(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }

    /// Id voor een PWA-record. De sync-versie van de PWA gebruikt al UUID's:
    /// die nemen we over (gelijk aan wat de PWA naar de server synct). Oudere
    /// id's worden deterministisch afgeleid, net als de migratie in de PWA.
    static func id(_ kind: String, _ raw: String, scope: String? = nil) -> UUID {
        if let uuid = UUID(uuidString: raw) { return uuid }
        return uuid(kind, scope.map { "\($0):\(raw)" } ?? raw)
    }

    static func milliseconds(_ date: Date) -> Int64 { Int64((date.timeIntervalSince1970 * 1000).rounded()) }

    /// Deterministische UUID (versie 5-stijl, op SHA-256) voor een PWA-id.
    static func uuid(_ kind: String, _ id: String) -> UUID {
        var bytes = Array(SHA256.hash(data: Data("puntenteller-pwa:\(kind):\(id)".utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x50
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}
