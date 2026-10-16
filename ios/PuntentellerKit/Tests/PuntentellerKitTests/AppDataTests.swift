import Foundation
import Testing
@testable import PuntentellerKit

@Suite struct AppDataTests {
    @Test func startGameRemembersNewPlayersAndLinksExisting() {
        var data = AppData()
        let first = data.startGame(name: " Rummikub ", rules: GameRules(), playerNames: ["Anna", "Bram"])
        #expect(first.name == "Rummikub")
        #expect(data.savedPlayers.map(\.name) == ["Anna", "Bram"])

        let second = data.startGame(name: "Yahtzee", rules: GameRules(), playerNames: ["anna", "Cas"])
        #expect(data.savedPlayers.map(\.name) == ["Anna", "Bram", "Cas"])
        #expect(second.players[0].savedPlayerId == data.savedPlayers[0].id)
        #expect(data.games.count == 2)
    }

    @Test func visibleGamesHidesDeletedAndSortsByLastPlayed() {
        var data = AppData()
        let t0 = Date(timeIntervalSince1970: 0)
        let a = data.startGame(name: "A", rules: GameRules(), playerNames: ["x", "y"], at: t0)
        let b = data.startGame(name: "B", rules: GameRules(), playerNames: ["x", "y"], at: t0.addingTimeInterval(10))
        let c = data.startGame(name: "C", rules: GameRules(), playerNames: ["x", "y"], at: t0.addingTimeInterval(20))
        data.updateGame(a.id) { $0.applyScore(1, to: $0.players[0].id, at: t0.addingTimeInterval(30)) }
        data.updateGame(c.id) { $0.markDeleted(at: t0.addingTimeInterval(40)) }
        #expect(data.visibleGames.map(\.id) == [a.id, b.id])
    }

    @Test func decodesFileWithMissingKeys() throws {
        let data = try JSONDecoder.puntenteller.decode(AppData.self, from: Data(#"{"games":[]}"#.utf8))
        #expect(data.savedPlayers.isEmpty && data.gameProfiles.isEmpty)
    }
}
