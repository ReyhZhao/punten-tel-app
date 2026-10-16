import Foundation
import Testing
@testable import PuntentellerKit

/// Export zoals `exportForIOS()` in de PWA die maakt, met data in de vorm van
/// `pwa-punten-v2` (inclusief velden uit oudere versies).
private func export(lastPlayedRummikub: Double = 1_760_000_600_000) -> Data {
    Data("""
    {
      "format": "puntenteller-pwa-export",
      "version": 1,
      "exportedAt": "2026-10-16T12:00:00.000Z",
      "data": {
        "screen": "home", "currentId": null, "keepAwake": true,
        "gameProfiles": [
          { "id": "prof1", "name": "Rummikub", "scoring": "high", "timerOn": false, "timerSecs": 60,
            "maxScore": 100, "maxRounds": null, "endMode": "round", "sortPlayers": true }
        ],
        "savedPlayers": [
          { "id": "sp1", "name": "Anna", "color": "#FF5A5F", "wins": 5, "profileWins": { "prof1": 3 } },
          { "id": "sp2", "name": "Bram", "color": "#FF8A3D", "wins": 0 }
        ],
        "games": [
          { "id": "g1", "name": "Rummikub", "profileId": "prof1", "scoring": "high", "timerOn": false,
            "timerSecs": 60, "maxScore": 100, "maxRounds": null, "endMode": "round", "endTurnsLeft": null,
            "sortPlayers": true,
            "players": [
              { "id": "p1", "name": "Anna", "color": "#FF5A5F", "score": 120 },
              { "id": "p2", "name": "Bram", "color": "#FF8A3D", "score": 40 }
            ],
            "log": [
              { "id": "l1", "playerId": "p1", "delta": 120, "ts": 1760000100000 },
              { "id": "l2", "playerId": "p2", "delta": 40, "ts": 1760000200000 }
            ],
            "createdAt": 1760000000000, "lastPlayed": \(lastPlayedRummikub), "finished": true },
          { "id": "g2", "name": "Oud spel", "scoring": "low", "timerOn": true, "timerSecs": 45,
            "maxScore": 50, "finishRound": true,
            "players": [
              { "id": "p1", "name": "anna", "color": "#FF5A5F", "score": 7 },
              { "id": "p3", "name": "Cas", "color": "#F4B400", "score": 3 }
            ],
            "log": [ { "id": "l1", "playerId": "p1", "delta": 5, "ts": 1750000100000 } ],
            "createdAt": 1750000000000, "lastPlayed": 1750000300000, "finished": false }
        ]
      }
    }
    """.utf8)
}

@Suite struct PWAImportTests {
    @Test func importsGamesProfilesAndPlayers() throws {
        var data = AppData()
        let summary = try data.importPWAExport(export())

        #expect(summary.gamesAdded == 2)
        #expect(summary.profilesAdded == 1)
        #expect(summary.playersAdded == 3)  // Anna, Bram, en Cas (alleen in een spel)
        #expect(data.gameProfiles.first?.rules.maxScore == 100)

        let rummikub = try #require(data.games.first { $0.name == "Rummikub" })
        #expect(rummikub.isFinished)
        #expect(rummikub.winner?.name == "Anna")
        #expect(rummikub.profileId == data.gameProfiles.first?.id)
        #expect(rummikub.lastPlayed == Date(timeIntervalSince1970: 1_760_000_600))
        #expect(rummikub.log.count == 2)
    }

    @Test func migratesOldFieldsAndCorrectsScoreMismatch() throws {
        var data = AppData()
        let summary = try data.importPWAExport(export())
        let old = try #require(data.games.first { $0.name == "Oud spel" })

        #expect(old.rules.endMode == .round)      // finishRound: true
        #expect(old.rules.sortPlayers == false)   // ontbrak
        #expect(old.rules.scoring == .low)
        // Anna: log 5, score 7 → +2 correctie. Cas: geen log, score 3 → +3 correctie.
        #expect(summary.scoreCorrections == 2)
        #expect(old.players.map { old.score(of: $0.id) } == [7, 3])
        // Anna in twee spellen (andere hoofdletters) is één bewaarde speler.
        #expect(old.players[0].savedPlayerId == data.savedPlayers.first { $0.name == "Anna" }?.id)
    }

    @Test func keepsWinsThatCannotBeDerived() throws {
        var data = AppData()
        try data.importPWAExport(export())
        let anna = try #require(data.savedPlayers.first { $0.name == "Anna" })
        let profile = try #require(data.gameProfiles.first)

        // 5 overwinningen in de PWA, waarvan 1 (Rummikub) als spel geïmporteerd.
        #expect(anna.importedWins == 4)
        #expect(Statistics.wins(of: anna, in: data.games) == 5)
        #expect(Statistics.wins(of: anna, in: data.games, profileId: profile.id) == 3)
    }

    @Test func reimportIsIdempotent() throws {
        var data = AppData()
        try data.importPWAExport(export())
        let before = data
        let summary = try data.importPWAExport(export())

        #expect(summary.gamesAdded == 0 && summary.gamesUnchanged == 2)
        #expect(summary.profilesAdded == 0 && summary.playersAdded == 0)
        #expect(data == before)
    }

    @Test func reimportAfterSavingToDiskIsUnchanged() throws {
        var data = AppData()
        try data.importPWAExport(export())
        // Zoals in de app: bewaren en weer laden via het JSON-formaat.
        data = try JSONDecoder.puntenteller.decode(AppData.self, from: JSONEncoder.puntenteller.encode(data))
        let summary = try data.importPWAExport(export())
        #expect(summary.gamesUpdated == 0 && summary.gamesUnchanged == 2)
    }

    @Test func reimportUpdatesGamesPlayedFurtherInPWA() throws {
        var data = AppData()
        try data.importPWAExport(export())
        let summary = try data.importPWAExport(export(lastPlayedRummikub: 1_760_009_000_000))
        #expect(summary.gamesUpdated == 1 && summary.gamesUnchanged == 1)
        #expect(data.games.count == 2)
    }

    @Test func mergesWithExistingIOSData() throws {
        var data = AppData()
        data.startGame(name: "Op iOS", rules: GameRules(), playerNames: ["ANNA", "Dirk"])
        try data.importPWAExport(export())
        #expect(data.games.count == 3)
        #expect(data.savedPlayers.map(\.name) == ["ANNA", "Dirk", "Bram", "Cas"])
    }

    @Test func acceptsRawLocalStorageJSON() throws {
        var data = AppData()
        let raw = Data(##"{"games":[],"savedPlayers":[{"id":"x","name":"Eva","color":"#00C2C7","wins":2}]}"##.utf8)
        let summary = try data.importPWAExport(raw)
        #expect(summary.playersAdded == 1)
        #expect(data.savedPlayers[0].importedWins == 2)
    }

    @Test func rejectsOtherFiles() {
        var data = AppData()
        #expect(throws: PWAImportError.notAnExport) {
            try data.importPWAExport(Data(#"{"hello":"world"}"#.utf8))
        }
        #expect(throws: PWAImportError.unsupportedVersion(2)) {
            try data.importPWAExport(Data(#"{"format":"puntenteller-pwa-export","version":2,"data":{"x":1}}"#.utf8))
        }
    }

    @Test func savedPlayerDecodesWithoutImportFields() throws {
        let json = ##"{"id":"7C1C1E2B-1B5A-4C7B-9C55-1B2A3C4D5E6F","name":"A","color":"#FFFFFF","updatedAt":"2026-01-01T00:00:00.000Z"}"##
        let sp = try JSONDecoder.puntenteller.decode(SavedPlayer.self, from: Data(json.utf8))
        #expect(sp.importedWins == 0 && sp.importedProfileWins.isEmpty)
    }
}
