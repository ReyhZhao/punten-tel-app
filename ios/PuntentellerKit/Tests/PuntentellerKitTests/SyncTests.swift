import Foundation
import Testing
@testable import PuntentellerKit

private let me = "aaaaaaaa-0000-4000-8000-000000000001"
private let anna = "bbbbbbbb-0000-4000-8000-000000000002"

/// Een antwoord zoals de backend het stuurt (kleine letters, ms, nulls).
private func response(_ json: String) throws -> SyncResponse {
    try JSONDecoder.puntenteller.decode(SyncResponse.self, from: Data(json.utf8))
}

private let sharedGameJSON = """
{
  "cursor": 42,
  "changes": {
    "games": [{
      "id": "11111111-1111-4111-8111-111111111111", "ownerId": "\(anna)", "name": "Klaverjassen",
      "profileId": null,
      "rules": {"scoring": "high", "timerOn": false, "timerSecs": 60, "maxScore": null, "maxRounds": null,
                "endMode": "round", "sortPlayers": true},
      "endTurnsLeft": null, "participantsCanScore": false,
      "createdAt": "2026-10-16T12:00:00.000Z", "updatedAt": "2026-10-16T12:05:00.000Z",
      "finishedAt": null, "deletedAt": null
    }],
    "players": [
      {"id": "22222222-2222-4222-8222-222222222222", "gameId": "11111111-1111-4111-8111-111111111111",
       "name": "Wij", "color": "#FF8A3D", "position": 1, "accountId": "\(me)", "updatedAt": "2026-10-16T12:00:00.000Z"},
      {"id": "33333333-3333-4333-8333-333333333333", "gameId": "11111111-1111-4111-8111-111111111111",
       "name": "Zij", "color": "#FF5A5F", "position": 0, "accountId": null, "updatedAt": "2026-10-16T12:00:00.000Z"}
    ],
    "scoreEntries": [
      {"id": "44444444-4444-4444-8444-444444444444", "gameId": "11111111-1111-4111-8111-111111111111",
       "playerId": "22222222-2222-4222-8222-222222222222", "delta": 162,
       "createdAt": "2026-10-16T12:01:00.000Z", "undoneAt": null, "createdBy": "\(anna)"}
    ],
    "gameProfiles": []
  },
  "removedGameIds": [],
  "accounts": [{"id": "\(anna)", "displayName": "Anna"}, {"id": "\(me)", "displayName": "Ik"}],
  "rejected": []
}
"""

@Suite struct SyncRequestTests {
    @Test func dirtyGamesAreSentWithPlayersAndEntries() throws {
        var data = AppData()
        let g = data.startGame(name: "Golf", rules: GameRules(), players: [NewPlayer(name: "Anna", accountId: anna), NewPlayer(name: "Bram")])
        data.updateGame(g.id) { $0.applyScore(3, to: $0.players[1].id) }

        let (request, snapshot) = data.syncRequest(me: me)
        #expect(request.cursor == nil)
        #expect(request.changes.games.map(\.id) == [g.id])
        #expect(request.changes.players.map(\.position) == [0, 1])
        #expect(request.changes.players[0].accountId == anna)
        #expect(request.changes.scoreEntries.count == 1)
        #expect(snapshot.games[g.id] == 2)

        // null blijft null in de JSON (ontkoppelen), cursor null bij de eerste sync.
        let json = String(decoding: try JSONEncoder.puntenteller.encode(request), as: UTF8.self)
        #expect(json.contains("\"accountId\":null"))
        #expect(json.contains("\"cursor\":null"))
        #expect(json.contains("Z\""))
    }

    @Test func cleanDataSendsNothing() {
        var data = AppData()
        data.startGame(name: "x", rules: GameRules(), playerNames: ["a", "b"])
        data.sync.dirtyGames = [:]
        #expect(data.syncRequest(me: me).0.changes.isEmpty)
    }

    @Test func participantsOnlySendEntriesWhenAllowed() throws {
        var data = AppData()
        data.applySync(try response(sharedGameJSON), sent: SyncSnapshot(games: [:], profiles: [:]))
        let id = data.games[0].id
        data.markDirty(game: id)
        var changes = data.syncRequest(me: me).0.changes
        #expect(changes.players.isEmpty)
        #expect(changes.scoreEntries.isEmpty)

        data.games[0].participantsCanScore = true
        changes = data.syncRequest(me: me).0.changes
        #expect(changes.players.isEmpty)
        #expect(changes.scoreEntries.count == 1)
    }

    @Test func longNamesAreTruncatedToServerLimits() {
        var data = AppData()
        data.startGame(name: String(repeating: "x", count: 200), rules: GameRules(), playerNames: [String(repeating: "y", count: 99), "b"])
        let changes = data.syncRequest(me: me).0.changes
        #expect(changes.games[0].name.count == 80)
        #expect(changes.players[0].name.count == 40)
    }
}

@Suite struct SyncApplyTests {
    @Test func sharedGameIsAddedWithOwnerPlayersAndEntries() throws {
        var data = AppData()
        data.applySync(try response(sharedGameJSON), sent: SyncSnapshot(games: [:], profiles: [:]))

        #expect(data.sync.cursor == 42)
        let game = try #require(data.games.first)
        #expect(game.name == "Klaverjassen")
        #expect(game.players.map(\.name) == ["Zij", "Wij"])  // op positie
        #expect(game.score(of: game.players[1].id) == 162)
        #expect(!game.isOwned(by: me))
        #expect(!game.canScore(as: me))
        #expect(data.sync.accountNames[anna] == "Anna")
        // Spelers van gedeelde spellen worden bewaarde spelers (statistiek).
        #expect(Set(data.savedPlayers.map(\.name)) == ["Zij", "Wij"])
        // Toepassen van de server markeert niets als gewijzigd.
        #expect(!data.sync.hasPendingChanges)
    }

    @Test func applyingTwiceChangesNothing() throws {
        var data = AppData()
        let r = try response(sharedGameJSON)
        data.applySync(r, sent: SyncSnapshot(games: [:], profiles: [:]))
        let once = data
        data.applySync(r, sent: SyncSnapshot(games: [:], profiles: [:]))
        #expect(data == once)
    }

    @Test func sentChangesAreClearedUnlessChangedDuringSync() throws {
        var data = AppData()
        let a = data.startGame(name: "A", rules: GameRules(), playerNames: ["x", "y"])
        let b = data.startGame(name: "B", rules: GameRules(), playerNames: ["x", "y"])
        let (_, snapshot) = data.syncRequest(me: me)
        // Tijdens de sync wordt B opnieuw gewijzigd.
        data.updateGame(b.id) { $0.applyScore(1, to: $0.players[0].id) }

        var r = try response(sharedGameJSON)
        r.changes = SyncChanges()
        r.changes.games = [GameDTO(
            id: b.id, ownerId: me, name: "Server-B", profileId: nil, rules: GameRules(), endTurnsLeft: nil,
            participantsCanScore: false, createdAt: .now, updatedAt: .now, finishedAt: nil, deletedAt: nil
        )]
        data.applySync(r, sent: snapshot)

        #expect(data.sync.dirtyGames[a.id] == nil)
        #expect(data.sync.dirtyGames[b.id] != nil)
        #expect(data.game(b.id)?.name == "B")  // lokale wijziging wint tot de volgende sync
    }

    @Test func removedGamesDisappear() throws {
        var data = AppData()
        data.applySync(try response(sharedGameJSON), sent: SyncSnapshot(games: [:], profiles: [:]))
        var r = try response(sharedGameJSON)
        r.changes = SyncChanges()
        r.removedGameIds = [data.games[0].id]
        data.applySync(r, sent: SyncSnapshot(games: [:], profiles: [:]))
        #expect(data.games.isEmpty)
    }

    @Test func undoFromServerIsApplied() throws {
        var data = AppData()
        data.applySync(try response(sharedGameJSON), sent: SyncSnapshot(games: [:], profiles: [:]))
        let undone = sharedGameJSON
            .replacingOccurrences(of: "\"undoneAt\": null", with: "\"undoneAt\": \"2026-10-16T12:02:00.000Z\"")
        data.applySync(try response(undone), sent: SyncSnapshot(games: [:], profiles: [:]))
        #expect(data.games[0].activeLog.isEmpty)
    }

    @Test func ownGamesBecomeOwnedAfterFirstSync() throws {
        var data = AppData()
        let g = data.startGame(name: "Eigen", rules: GameRules(), playerNames: ["a", "b"])
        #expect(g.isOwned(by: me))
        let (_, snapshot) = data.syncRequest(me: me)
        var r = try response(sharedGameJSON)
        r.changes = SyncChanges()
        r.changes.games = [GameDTO(
            id: g.id, ownerId: me.uppercased(), name: "Eigen", profileId: nil, rules: GameRules(), endTurnsLeft: nil,
            participantsCanScore: false, createdAt: g.createdAt, updatedAt: g.updatedAt, finishedAt: nil, deletedAt: nil
        )]
        data.applySync(r, sent: snapshot)
        #expect(data.game(g.id)?.ownerId == me)
        #expect(data.game(g.id)?.isOwned(by: me) == true)
    }

    @Test func markEverythingDirtyForFirstUpload() {
        var data = AppData()
        let g = data.startGame(name: "x", rules: GameRules(), playerNames: ["a", "b"])
        data.saveProfile(name: "P", rules: GameRules())
        data.resetSync()
        #expect(!data.sync.hasPendingChanges)
        data.markEverythingDirty()
        #expect(data.sync.dirtyGames[g.id] != nil)
        #expect(data.sync.dirtyProfiles.count == 1)
    }

    @Test func oldFilesWithoutSyncFieldsStillLoad() throws {
        var data = AppData()
        data.startGame(name: "x", rules: GameRules(), playerNames: ["a", "b"])
        var json = try JSONSerialization.jsonObject(with: JSONEncoder.puntenteller.encode(data)) as! [String: Any]
        json["sync"] = nil
        var games = json["games"] as! [[String: Any]]
        games[0]["participantsCanScore"] = nil
        games[0]["ownerId"] = nil
        json["games"] = games
        let decoded = try JSONDecoder.puntenteller.decode(AppData.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(decoded.games[0].participantsCanScore == false)
        #expect(decoded.sync.cursor == nil)
    }
}

@Suite struct SharingEditTests {
    @Test func linkingAPlayerMarksTheGameAndRemembersTheAccount() throws {
        var data = AppData()
        let g = data.startGame(name: "x", rules: GameRules(), playerNames: ["Anna", "Bram"])
        data.sync.dirtyGames = [:]
        let later = Date.now.addingTimeInterval(60)
        data.linkPlayer(g.players[1].id, to: anna, in: g.id, at: later)
        let game = try #require(data.game(g.id))
        #expect(game.players[1].accountId == anna)
        #expect(game.players[1].updatedAt == later)
        #expect(data.sync.dirtyGames[g.id] != nil)
        #expect(data.savedPlayers.first { $0.name == "Bram" }?.accountId == anna)
        // Ontkoppelen laat de bewaarde speler zijn account houden (voor later opnieuw uitnodigen).
        data.linkPlayer(g.players[1].id, to: nil, in: g.id)
        #expect(data.game(g.id)?.players[1].accountId == nil)
        #expect(data.savedPlayers.first { $0.name == "Bram" }?.accountId == anna)
    }

    @Test func participantsCanScoreIsSentWithANewerTimestamp() throws {
        var data = AppData()
        let g = data.startGame(name: "x", rules: GameRules(), playerNames: ["a", "b"])
        let later = g.updatedAt.addingTimeInterval(5)
        data.setParticipantsCanScore(true, in: g.id, at: later)
        let dto = try #require(data.syncRequest(me: me).0.changes.games.first)
        #expect(dto.participantsCanScore)
        #expect(dto.updatedAt == later)
    }

    @Test func stayOnOwnPlayerIsSent() throws {
        var data = AppData()
        let g = data.startGame(name: "x", rules: GameRules(), playerNames: ["a", "b"])
        data.setStayOnOwnPlayer(true, in: g.id, at: g.updatedAt.addingTimeInterval(5))
        let dto = try #require(data.syncRequest(me: me).0.changes.games.first)
        #expect(dto.stayOnOwnPlayer == true)
    }

    @Test func inputStaysOnOwnPlayerOnlyWhenEnabledAndAllowed() throws {
        var data = AppData()
        // Ouder serverantwoord zonder stayOnOwnPlayer: staat uit.
        data.applySync(try response(sharedGameJSON), sent: SyncSnapshot(games: [:], profiles: [:]))
        var game = try #require(data.games.first)
        let wij = try #require(game.players.first { $0.name == "Wij" })
        #expect(game.ownInputPlayer(as: me) == nil)

        game.stayOnOwnPlayer = true
        #expect(game.ownInputPlayer(as: me) == nil)  // deelnemer mag (nog) niet boeken
        game.participantsCanScore = true
        #expect(game.ownInputPlayer(as: me) == wij.id)
        #expect(game.ownInputPlayer(as: me.uppercased()) == wij.id)
        #expect(game.ownInputPlayer(as: nil) == nil)
        // Eigenaar zonder eigen speler in dit spel: invoer schuift gewoon door.
        #expect(game.ownInputPlayer(as: anna) == nil)
    }
}
