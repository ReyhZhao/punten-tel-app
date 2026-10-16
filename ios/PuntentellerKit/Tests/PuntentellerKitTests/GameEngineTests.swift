import Foundation
import Testing
@testable import PuntentellerKit

private func makeGame(_ names: [String] = ["Anna", "Bram", "Cas"], rules: GameRules = GameRules()) -> Game {
    Game.start(name: "Test", rules: rules, players: names.map { Player(name: $0, color: "") })
}

@Suite struct ScoringTests {
    @Test func scoreIsSumOfActiveEntries() {
        var g = makeGame()
        let a = g.players[0].id
        g.applyScore(5, to: a)
        g.applyScore(-2, to: a)
        #expect(g.score(of: a) == 3)
        #expect(g.score(of: g.players[1].id) == 0)
    }

    @Test func playersGetColorsInOrder() {
        let g = makeGame()
        #expect(g.players.map(\.color) == Array(PlayerColors.all.prefix(3)))
    }

    @Test func undoRestoresScoreAndKeepsTombstone() {
        var g = makeGame()
        let a = g.players[0].id
        g.applyScore(5, to: a)
        g.undo(entryId: g.log[0].id)
        #expect(g.score(of: a) == 0)
        #expect(g.log.count == 1)
        #expect(g.log[0].undoneAt != nil)
    }

    @Test func rankingFollowsScoringDirection() {
        var g = makeGame(rules: GameRules(scoring: .low))
        g.applyScore(10, to: g.players[0].id)
        g.applyScore(3, to: g.players[1].id)
        g.applyScore(7, to: g.players[2].id)
        #expect(g.ranked.map(\.name) == ["Bram", "Cas", "Anna"])
    }

    @Test func leadersEmptyUntilFirstEntryAndIncludeTies() {
        var g = makeGame()
        #expect(g.leaders.isEmpty)
        g.applyScore(4, to: g.players[0].id)
        g.applyScore(4, to: g.players[2].id)
        #expect(g.leaders.map(\.name) == ["Anna", "Cas"])
    }

    @Test func displayOrderRespectsSortPlayers() {
        var g = makeGame(rules: GameRules(sortPlayers: false))
        g.applyScore(9, to: g.players[2].id)
        #expect(g.displayOrder.map(\.name) == ["Anna", "Bram", "Cas"])
    }

    @Test func finishedGameIgnoresScores() {
        var g = makeGame()
        g.finish()
        #expect(g.applyScore(1, to: g.players[0].id) == .ignored)
        #expect(g.log.isEmpty)
    }
}

@Suite struct EndOfGameTests {
    @Test func immediateFinishesOnMaxScore() {
        var g = makeGame(rules: GameRules(maxScore: 10, endMode: .immediate))
        #expect(g.applyScore(10, to: g.players[1].id) == .finished)
        #expect(g.winner?.name == "Bram")
    }

    @Test func roundLetsLaterPlayersFinishTheRound() {
        var g = makeGame(rules: GameRules(maxScore: 10, endMode: .round))
        let ids = g.players.map(\.id)
        // Anna (index 0) triggert: Bram en Cas spelen nog.
        #expect(g.applyScore(10, to: ids[0]) == .continued)
        #expect(g.endTurnsLeft == 2)
        #expect(g.applyScore(0, to: ids[1]) == .continued)
        #expect(g.applyScore(12, to: ids[2]) == .finished)
        #expect(g.winner?.name == "Cas")
    }

    @Test func roundTriggeredByLastPlayerFinishesDirectly() {
        var g = makeGame(rules: GameRules(maxScore: 10, endMode: .round))
        #expect(g.applyScore(10, to: g.players[2].id) == .finished)
    }

    @Test func extraTurnGivesEveryoneElseOneTurn() {
        var g = makeGame(rules: GameRules(maxScore: 10, endMode: .extraTurn))
        let ids = g.players.map(\.id)
        #expect(g.applyScore(10, to: ids[2]) == .continued)
        #expect(g.endTurnsLeft == 2)
        #expect(g.applyScore(1, to: ids[0]) == .continued)
        #expect(g.applyScore(1, to: ids[1]) == .finished)
    }

    @Test func maxRoundsFinishesAfterEveryoneHadTheirTurns() {
        var g = makeGame(["Anna", "Bram"], rules: GameRules(maxRounds: 2))
        let ids = g.players.map(\.id)
        #expect(g.applyScore(1, to: ids[0]) == .continued)
        #expect(g.applyScore(0, to: ids[1]) == .continued)
        #expect(g.completedRounds == 1)
        #expect(g.applyScore(1, to: ids[0]) == .continued)
        #expect(g.applyScore(0, to: ids[1]) == .finished)
    }

    @Test func undoneEntriesDoNotCountTowardsRounds() {
        var g = makeGame(["Anna", "Bram"], rules: GameRules(maxRounds: 1))
        let ids = g.players.map(\.id)
        g.applyScore(1, to: ids[0])
        g.undo(entryId: g.log[0].id)
        #expect(g.applyScore(1, to: ids[1]) == .continued)
    }
}

@Suite struct LifecycleTests {
    @Test func rematchCreatesNewGameAndKeepsOld() {
        var g = makeGame()
        g.applyScore(5, to: g.players[0].id)
        g.finish()
        let next = g.rematch()
        #expect(next.id != g.id)
        #expect(next.players.map(\.name) == g.players.map(\.name))
        #expect(Set(next.players.map(\.id)).isDisjoint(with: g.players.map(\.id)))
        #expect(next.log.isEmpty && !next.isFinished)
        #expect(g.winner?.name == "Anna")
    }

    @Test func resetScoresTombstonesAllEntries() {
        var g = makeGame()
        g.applyScore(5, to: g.players[0].id)
        g.applyScore(3, to: g.players[1].id)
        g.resetScores()
        #expect(g.players.allSatisfy { g.score(of: $0.id) == 0 })
        #expect(g.log.allSatisfy { !$0.isActive })
    }

    @Test func winsAreDerivedFromFinishedGames() {
        let anna = SavedPlayer(name: "Anna", color: "#FF5A5F")
        let profile = UUID()
        var g1 = Game.start(name: "1", profileId: profile, rules: GameRules(), players: [
            Player(name: "anna", color: ""), Player(name: "Bram", color: ""),
        ])
        g1.applyScore(5, to: g1.players[0].id)
        g1.finish()
        var g2 = g1.rematch()
        g2.applyScore(5, to: g2.players[1].id)
        g2.finish()
        var g3 = makeGame(["Anna", "Bram"])
        g3.applyScore(1, to: g3.players[0].id)  // niet afgerond: telt niet

        #expect(Statistics.wins(of: anna, in: [g1, g2, g3]) == 1)
        #expect(Statistics.wins(of: anna, in: [g1, g2, g3], profileId: profile) == 1)
        #expect(Statistics.wins(of: anna, in: [g1, g2, g3], profileId: UUID()) == 0)
    }
}

@Suite struct CodingTests {
    @Test func roundTripsThroughWireFormat() throws {
        var g = makeGame()
        g.applyScore(7, to: g.players[0].id)
        let data = try JSONEncoder.puntenteller.encode(g)
        let json = String(decoding: data, as: UTF8.self)
        #expect(json.contains("Z\""))
        let decoded = try JSONDecoder.puntenteller.decode(Game.self, from: data)
        #expect(decoded.id == g.id)
        #expect(decoded.score(of: g.players[0].id) == 7)
        #expect(abs(decoded.createdAt.timeIntervalSince(g.createdAt)) < 0.001)
    }
}
