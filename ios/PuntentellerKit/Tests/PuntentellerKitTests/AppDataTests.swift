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

    @Test func mySavedPlayerPrefersChoiceThenAccount() {
        var data = AppData()
        data.startGame(name: "A", rules: GameRules(), players: [NewPlayer(name: "Anna"), NewPlayer(name: "Bram", accountId: "acc-b")])
        let anna = data.savedPlayers[0]
        #expect(data.mySavedPlayer(id: anna.id, accountId: "ACC-B")?.name == "Anna")
        #expect(data.mySavedPlayer(id: nil, accountId: "ACC-B")?.name == "Bram")
        #expect(data.mySavedPlayer(id: nil, accountId: nil) == nil)
        #expect(data.mySavedPlayer(id: UUID(), accountId: "acc-b") == nil)
    }

    @Test func decodesFileWithMissingKeys() throws {
        let data = try JSONDecoder.puntenteller.decode(AppData.self, from: Data(#"{"games":[]}"#.utf8))
        #expect(data.savedPlayers.isEmpty && data.gameProfiles.isEmpty)
    }
}

@Suite struct ProfileAndStatsTests {
    @Test func saveProfileAddsOrUpdatesByName() {
        var data = AppData()
        let first = data.saveProfile(name: " Rummikub ", rules: GameRules(maxScore: 100))
        #expect(first.name == "Rummikub")
        let again = data.saveProfile(name: "rummikub", rules: GameRules(maxScore: 50))
        #expect(again.id == first.id)
        #expect(data.gameProfiles.count == 1)
        #expect(data.profile(named: "RUMMIKUB")?.rules.maxScore == 50)
        #expect(data.profile(named: "  ") == nil)
    }

    @Test func rematchAppendsNewGameAndKeepsOld() throws {
        var data = AppData()
        var g = data.startGame(name: "A", rules: GameRules(), playerNames: ["x", "y"])
        data.updateGame(g.id) { $0.applyScore(3, to: $0.players[0].id); $0.finish() }
        g = try #require(data.game(g.id))
        let rematched = data.rematch(g.id)
        let next = try #require(rematched)
        #expect(data.games.count == 2)
        #expect(next.players.map(\.savedPlayerId) == g.players.map(\.savedPlayerId))
        #expect(data.game(g.id)?.isFinished == true)
    }

    @Test func currentRoundIsCappedAtMaxRounds() {
        var g = Game.start(name: "R", rules: GameRules(maxRounds: 2), players: [Player(name: "a", color: ""), Player(name: "b", color: "")])
        #expect(g.currentRound == 1)
        g.applyScore(1, to: g.players[0].id)
        g.applyScore(1, to: g.players[1].id)
        #expect(g.currentRound == 2)
        g.applyScore(1, to: g.players[0].id)
        g.applyScore(1, to: g.players[1].id)
        #expect(g.currentRound == 2)
        #expect(Game.start(name: "x", rules: GameRules(), players: []).currentRound == nil)
    }

    @Test func leaderboardSortsByWinsThenName() {
        var data = AppData()
        let profile = data.saveProfile(name: "Golf", rules: GameRules())
        for winner in [0, 1, 1] {
            var g = data.startGame(name: "Golf", rules: GameRules(), playerNames: ["Cas", "Bram", "anna"], profileId: winner == 0 ? profile.id : nil)
            data.updateGame(g.id) { $0.applyScore(5, to: $0.players[winner].id); $0.finish() }
            g = data.game(g.id)!
        }
        let total = Statistics.leaderboard(data.savedPlayers, in: data.games)
        #expect(total.map(\.player.name) == ["Bram", "Cas", "anna"])
        #expect(total.map(\.wins) == [2, 1, 0])
        let golf = Statistics.leaderboard(data.savedPlayers, in: data.games, profileId: profile.id)
        #expect(golf.map(\.player.name) == ["Cas", "anna", "Bram"])
    }
}
