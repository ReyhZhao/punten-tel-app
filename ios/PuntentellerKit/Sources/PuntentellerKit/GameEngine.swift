import Foundation

// Spelregels en ranglijst, geport uit `useAppState` in frontend/src/store.ts.
// Waar het gedrag bewust anders is, staat dat in docs/adr/0002-sync-klaar-datamodel.md.

public enum ScoreOutcome: Equatable, Sendable {
    /// Het spel loopt door.
    case continued
    /// Door deze boeking is het spel afgelopen.
    case finished
    /// Het spel was al afgerond of de speler bestaat niet; er is niets gebeurd.
    case ignored
}

extension Game {
    /// Maakt een nieuw spel. Spelers krijgen hun kleur op volgorde (gelijk aan `createGame`).
    public static func start(
        name: String,
        profileId: UUID? = nil,
        rules: GameRules,
        players: [Player],
        at now: Date = .now
    ) -> Game {
        let colored = players.enumerated().map { i, p in
            var p = p
            p.color = PlayerColors.color(at: i)
            p.updatedAt = now
            return p
        }
        return Game(name: name, profileId: profileId, rules: rules, players: colored, createdAt: now)
    }

    /// Boekingen die nog meetellen.
    public var activeLog: [ScoreEntry] { log.filter(\.isActive) }

    public func score(of playerId: UUID) -> Int {
        log.reduce(0) { $1.isActive && $1.playerId == playerId ? $0 + $1.delta : $0 }
    }

    /// Aantal volledige rondes: elke speler heeft één beurt gehad.
    public var completedRounds: Int {
        players.isEmpty ? 0 : activeLog.count / players.count
    }

    /// De ronde die nu gespeeld wordt (1-gebaseerd), alleen bij een max aantal rondes.
    public var currentRound: Int? {
        rules.maxRounds.map { min(completedRounds + 1, $0) }
    }

    /// Spelers op stand: oplopend bij `low`, aflopend bij `high`. Bij gelijke
    /// stand blijft de volgorde van `players` staan.
    public var ranked: [Player] {
        let scores = Dictionary(uniqueKeysWithValues: players.map { ($0.id, score(of: $0.id)) })
        return players.enumerated().sorted { a, b in
            let sa = scores[a.element.id]!, sb = scores[b.element.id]!
            if sa != sb { return rules.scoring == .low ? sa < sb : sa > sb }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// De volgorde op het score-scherm: op stand als `sortPlayers` aan staat, anders zoals ingevoerd.
    public var displayOrder: [Player] { rules.sortPlayers ? ranked : players }

    /// Speler(s) met de beste stand. Leeg zolang er nog niets geboekt is.
    public var leaders: [Player] {
        guard !activeLog.isEmpty, let best = ranked.first.map({ score(of: $0.id) }) else { return [] }
        return ranked.filter { score(of: $0.id) == best }
    }

    /// Nummer één van de ranglijst, alleen als het spel afgerond is.
    public var winner: Player? { isFinished ? ranked.first : nil }

    /// Boekt `delta` voor een speler en kijkt daarna of het spel afgelopen is.
    @discardableResult
    public mutating func applyScore(_ delta: Int, to playerId: UUID, at now: Date = .now) -> ScoreOutcome {
        guard !isFinished, let triggerIdx = players.firstIndex(where: { $0.id == playerId }) else {
            return .ignored
        }
        log.append(ScoreEntry(playerId: playerId, delta: delta, createdAt: now))
        updatedAt = now

        if let maxScore = rules.maxScore {
            if let turnsLeft = endTurnsLeft {
                // Al getriggerd: deze beurt telt mee in de aftelling.
                if turnsLeft - 1 <= 0 { return finish(at: now) }
                endTurnsLeft = turnsLeft - 1
            } else if players.contains(where: { score(of: $0.id) >= maxScore }) {
                // Net getriggerd.
                let n = players.count
                let left: Int
                switch rules.endMode {
                case .immediate: return finish(at: now)
                // 'round': alleen spelers ná de trigger maken de ronde af.
                case .round: left = n - 1 - triggerIdx
                // 'extraTurn': alle andere spelers krijgen nog één beurt.
                case .extraTurn: left = n - 1
                }
                if left <= 0 { return finish(at: now) }
                endTurnsLeft = left
            }
        }

        // Harde grens op het aantal rondes, los van de max score: wat het eerst komt, telt.
        if let maxRounds = rules.maxRounds, activeLog.count >= maxRounds * players.count {
            return finish(at: now)
        }
        return .continued
    }

    /// Trekt een boeking in. De stand wordt vanzelf hersteld, want die komt uit het logboek.
    public mutating func undo(entryId: UUID, at now: Date = .now) {
        guard let i = log.firstIndex(where: { $0.id == entryId }), log[i].isActive else { return }
        log[i].undoneAt = now
        updatedAt = now
    }

    /// Rondt het spel af (handmatig, of doordat de regels het einde bereiken).
    @discardableResult
    public mutating func finish(at now: Date = .now) -> ScoreOutcome {
        guard !isFinished else { return .ignored }
        finishedAt = now
        endTurnsLeft = nil
        updatedAt = now
        return .finished
    }

    /// Zet alle standen op 0 door alle actieve boekingen in te trekken.
    public mutating func resetScores(at now: Date = .now) {
        for i in log.indices where log[i].isActive { log[i].undoneAt = now }
        endTurnsLeft = nil
        updatedAt = now
    }

    /// Nieuw spel met dezelfde naam, spelregels en spelers. Dit spel blijft
    /// ongewijzigd, zodat de uitslag bewaard blijft (ADR-0002).
    public func rematch(at now: Date = .now) -> Game {
        let fresh = players.map {
            Player(name: $0.name, color: $0.color, savedPlayerId: $0.savedPlayerId, accountId: $0.accountId, updatedAt: now)
        }
        return Game(
            name: name, profileId: profileId, rules: rules, players: fresh, createdAt: now,
            participantsCanScore: participantsCanScore, stayOnOwnPlayer: stayOnOwnPlayer
        )
    }

    public mutating func markDeleted(at now: Date = .now) {
        deletedAt = now
        updatedAt = now
    }
}

/// Statistieken die uit afgeronde spellen worden afgeleid.
public enum Statistics {
    /// Aantal gewonnen spellen van een bewaarde speler. Als `profileId` gegeven
    /// is, tellen alleen spellen van dat profiel. Spelers worden gekoppeld via
    /// `savedPlayerId` en anders op naam (hoofdletterongevoelig, zoals de PWA).
    /// Overwinningen uit een PWA-import die niet af te leiden zijn, tellen mee.
    public static func wins(of saved: SavedPlayer, in games: [Game], profileId: UUID? = nil) -> Int {
        let derived = games.filter { g in
            guard !g.isDeleted, let w = g.winner else { return false }
            if let profileId, g.profileId != profileId { return false }
            if let sid = w.savedPlayerId { return sid == saved.id }
            return w.name.caseInsensitiveCompare(saved.name) == .orderedSame
        }.count
        let imported = profileId.map { saved.importedProfileWins[$0.uuidString] ?? 0 } ?? saved.importedWins
        return derived + imported
    }

    /// Bewaarde spelers op aantal overwinningen (meeste eerst, daarna op naam),
    /// totaal of voor één profiel. Zoals `PlayersScreen.tsx`.
    public static func leaderboard(
        _ players: [SavedPlayer], in games: [Game], profileId: UUID? = nil
    ) -> [(player: SavedPlayer, wins: Int)] {
        let nl = Locale(identifier: "nl_NL")
        return players
            .map { (player: $0, wins: wins(of: $0, in: games, profileId: profileId)) }
            .sorted { a, b in
                if a.wins != b.wins { return a.wins > b.wins }
                return a.player.name.compare(b.player.name, options: .caseInsensitive, locale: nl) == .orderedAscending
            }
    }
}
