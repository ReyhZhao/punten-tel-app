import Foundation

// Sync met de backend (backend/README.md, ADR-0003). Hier zit alleen de
// logica: welke records mee moeten, en hoe een antwoord wordt toegepast.
// Netwerk en inloggen zitten in de app.

// MARK: - Sync-status (wordt met AppData bewaard)

public struct SyncState: Codable, Hashable, Sendable {
    /// Hoogste revisie die we van de server hebben gezien. nil = nog nooit gesynct.
    public var cursor: Int?
    /// Lokale wijzigingen per spel: een teller die bij elke wijziging ophoogt.
    /// Een spel staat erin zolang het nog niet naar de server is gestuurd.
    public var dirtyGames: [UUID: Int] = [:]
    public var dirtyProfiles: [UUID: Int] = [:]
    /// Schermnamen van accounts (eigenaren en gekoppelde spelers).
    public var accountNames: [String: String] = [:]

    public init() {}

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        cursor = try c.decodeIfPresent(Int.self, forKey: .cursor)
        dirtyGames = try c.decodeIfPresent([UUID: Int].self, forKey: .dirtyGames) ?? [:]
        dirtyProfiles = try c.decodeIfPresent([UUID: Int].self, forKey: .dirtyProfiles) ?? [:]
        accountNames = try c.decodeIfPresent([String: String].self, forKey: .accountNames) ?? [:]
    }

    public var hasPendingChanges: Bool { !dirtyGames.isEmpty || !dirtyProfiles.isEmpty }
}

/// Wat er met een sync-verzoek is meegestuurd, om na het antwoord te weten
/// welke wijzigingen verwerkt zijn.
public struct SyncSnapshot: Sendable {
    public let games: [UUID: Int]
    public let profiles: [UUID: Int]
}

// MARK: - API-modellen (camelCase, ISO-8601, zoals de backend)

public struct SyncRequest: Encodable, Sendable {
    public var cursor: Int?
    public var changes: SyncChanges

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(cursor, forKey: .cursor)  // null bij de eerste sync
        try c.encode(changes, forKey: .changes)
    }

    enum CodingKeys: String, CodingKey { case cursor, changes }
}

public struct SyncChanges: Codable, Sendable, Equatable {
    public var games: [GameDTO] = []
    public var players: [PlayerDTO] = []
    public var scoreEntries: [ScoreEntryDTO] = []
    public var gameProfiles: [GameProfileDTO] = []

    public init() {}

    public var isEmpty: Bool { games.isEmpty && players.isEmpty && scoreEntries.isEmpty && gameProfiles.isEmpty }
}

public struct GameDTO: Codable, Sendable, Equatable {
    public var id: UUID
    public var ownerId: String?
    public var name: String
    public var profileId: UUID?
    public var rules: GameRules
    public var endTurnsLeft: Int?
    public var participantsCanScore: Bool
    /// Optioneel: een oudere backend kent het veld nog niet.
    public var stayOnOwnPlayer: Bool?
    public var createdAt: Date
    public var updatedAt: Date
    public var finishedAt: Date?
    public var deletedAt: Date?
}

public struct PlayerDTO: Codable, Sendable, Equatable {
    public var id: UUID
    public var gameId: UUID
    public var name: String
    public var color: String
    public var position: Int
    /// Altijd meesturen (ook als null): null betekent "ontkoppeld".
    public var accountId: String?
    public var updatedAt: Date

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(gameId, forKey: .gameId)
        try c.encode(name, forKey: .name)
        try c.encode(color, forKey: .color)
        try c.encode(position, forKey: .position)
        try c.encode(accountId, forKey: .accountId)
        try c.encode(updatedAt, forKey: .updatedAt)
    }
}

public struct ScoreEntryDTO: Codable, Sendable, Equatable {
    public var id: UUID
    public var gameId: UUID
    public var playerId: UUID
    public var delta: Int
    public var createdAt: Date
    public var undoneAt: Date?
    public var createdBy: String?
}

public struct GameProfileDTO: Codable, Sendable, Equatable {
    public var id: UUID
    public var ownerId: String?
    public var name: String
    public var rules: GameRules
    public var updatedAt: Date
    public var deletedAt: Date?
}

public struct AccountDTO: Codable, Sendable, Equatable {
    public var id: String
    public var displayName: String
}

public struct SyncRejection: Codable, Sendable, Equatable {
    public var type: String
    public var id: String
    public var reason: String
}

public struct SyncResponse: Codable, Sendable {
    public var cursor: Int
    public var changes: SyncChanges
    public var removedGameIds: [UUID]
    public var accounts: [AccountDTO]
    public var rejected: [SyncRejection]
}

// MARK: - Rechten

extension Game {
    /// Van jou: nog niet gesynct (geen eigenaar) of jij bent de eigenaar.
    public func isOwned(by accountId: String?) -> Bool {
        guard let ownerId else { return true }
        return ownerId.caseInsensitiveCompare(accountId ?? "") == .orderedSame
    }

    /// Mag dit account punten boeken? De eigenaar altijd, deelnemers als dat aan staat.
    public func canScore(as accountId: String?) -> Bool {
        isOwned(by: accountId) || participantsCanScore
    }

    /// Speler waar de invoer op blijft staan als "Invoer op eigen speler" aan
    /// staat en dit account mag boeken; anders nil (invoer schuift door).
    public func ownInputPlayer(as accountId: String?) -> UUID? {
        guard stayOnOwnPlayer, canScore(as: accountId), let accountId else { return nil }
        return players.first { $0.accountId?.caseInsensitiveCompare(accountId) == .orderedSame }?.id
    }
}

// MARK: - Wijzigingen bijhouden en verzenden

/// Grenzen van de backend; langer zou de hele sync laten mislukken.
private enum Limits {
    static let gameName = 80
    static let playerName = 40
}

extension AppData {
    /// Markeer een spel als lokaal gewijzigd (gaat mee met de volgende sync).
    public mutating func markDirty(game id: UUID) {
        sync.dirtyGames[id, default: 0] += 1
    }

    public mutating func markDirty(profile id: UUID) {
        sync.dirtyProfiles[id, default: 0] += 1
    }

    /// Alles opnieuw versturen, bv. na het inloggen (lokale spellen uploaden).
    public mutating func markEverythingDirty() {
        for g in games { markDirty(game: g.id) }
        for p in gameProfiles where p.ownerId == nil { markDirty(profile: p.id) }
    }

    /// Het verzoek voor de volgende sync, plus wat erin zit.
    public func syncRequest(me accountId: String?) -> (SyncRequest, SyncSnapshot) {
        var changes = SyncChanges()
        for profile in gameProfiles where sync.dirtyProfiles[profile.id] != nil {
            guard profile.ownerId == nil || profile.ownerId == accountId else { continue }
            changes.gameProfiles.append(GameProfileDTO(
                id: profile.id, ownerId: nil, name: String(profile.name.prefix(Limits.gameName)),
                rules: profile.rules, updatedAt: profile.updatedAt, deletedAt: profile.deletedAt
            ))
        }
        for game in games where sync.dirtyGames[game.id] != nil {
            changes.games.append(GameDTO(
                id: game.id, ownerId: nil, name: String(game.name.prefix(Limits.gameName)),
                profileId: game.profileId, rules: game.rules, endTurnsLeft: game.endTurnsLeft,
                participantsCanScore: game.participantsCanScore, stayOnOwnPlayer: game.stayOnOwnPlayer,
                createdAt: game.createdAt,
                updatedAt: game.updatedAt, finishedAt: game.finishedAt, deletedAt: game.deletedAt
            ))
            // Spelers wijzigt alleen de eigenaar; deelnemers sturen alleen boekingen.
            if game.isOwned(by: accountId) {
                for (i, p) in game.players.enumerated() {
                    changes.players.append(PlayerDTO(
                        id: p.id, gameId: game.id, name: String(p.name.prefix(Limits.playerName)),
                        color: p.color, position: i, accountId: p.accountId, updatedAt: p.updatedAt
                    ))
                }
            }
            if game.canScore(as: accountId) {
                for e in game.log {
                    changes.scoreEntries.append(ScoreEntryDTO(
                        id: e.id, gameId: game.id, playerId: e.playerId, delta: e.delta,
                        createdAt: e.createdAt, undoneAt: e.undoneAt
                    ))
                }
            }
        }
        return (
            SyncRequest(cursor: sync.cursor, changes: changes),
            SyncSnapshot(games: sync.dirtyGames, profiles: sync.dirtyProfiles)
        )
    }

    // MARK: - Antwoord toepassen

    /// Past het antwoord van de server toe. Records die tijdens de sync lokaal
    /// opnieuw gewijzigd zijn, worden overgeslagen: die gaan bij de volgende
    /// sync mee, en dan beslist de server met last-writer-wins.
    public mutating func applySync(_ response: SyncResponse, sent: SyncSnapshot) {
        // Wat ongewijzigd is sinds het verzenden, is nu verwerkt.
        for (id, version) in sent.games where sync.dirtyGames[id] == version { sync.dirtyGames[id] = nil }
        for (id, version) in sent.profiles where sync.dirtyProfiles[id] == version { sync.dirtyProfiles[id] = nil }
        let busyGames = Set(sync.dirtyGames.keys)
        let busyProfiles = Set(sync.dirtyProfiles.keys)

        for dto in response.changes.gameProfiles where !busyProfiles.contains(dto.id) {
            let profile = GameProfile(
                id: dto.id, name: dto.name, rules: dto.rules, updatedAt: dto.updatedAt,
                deletedAt: dto.deletedAt, ownerId: dto.ownerId?.lowercased()
            )
            if let i = gameProfiles.firstIndex(where: { $0.id == dto.id }) {
                gameProfiles[i] = profile
            } else {
                gameProfiles.append(profile)
            }
        }

        for dto in response.changes.games where !busyGames.contains(dto.id) {
            if let i = games.firstIndex(where: { $0.id == dto.id }) {
                games[i].name = dto.name
                games[i].profileId = dto.profileId
                games[i].rules = dto.rules
                games[i].endTurnsLeft = dto.endTurnsLeft
                games[i].participantsCanScore = dto.participantsCanScore
                games[i].stayOnOwnPlayer = dto.stayOnOwnPlayer ?? false
                games[i].updatedAt = dto.updatedAt
                games[i].finishedAt = dto.finishedAt
                games[i].deletedAt = dto.deletedAt
                games[i].ownerId = dto.ownerId?.lowercased()
            } else {
                games.append(Game(
                    id: dto.id, name: dto.name, profileId: dto.profileId, rules: dto.rules, players: [],
                    endTurnsLeft: dto.endTurnsLeft, createdAt: dto.createdAt, updatedAt: dto.updatedAt,
                    finishedAt: dto.finishedAt, deletedAt: dto.deletedAt,
                    ownerId: dto.ownerId?.lowercased(), participantsCanScore: dto.participantsCanScore,
                    stayOnOwnPlayer: dto.stayOnOwnPlayer ?? false
                ))
            }
        }

        let playersByGame = Dictionary(grouping: response.changes.players, by: \.gameId)
        for (gameId, dtos) in playersByGame where !busyGames.contains(gameId) {
            updateGame(gameId, markingDirty: false) { game in
                for dto in dtos.sorted(by: { $0.position < $1.position }) {
                    if let i = game.players.firstIndex(where: { $0.id == dto.id }) {
                        game.players[i].name = dto.name
                        game.players[i].color = dto.color
                        game.players[i].accountId = dto.accountId?.lowercased()
                        game.players[i].updatedAt = dto.updatedAt
                        if i != dto.position, game.players.indices.contains(dto.position) {
                            game.players.swapAt(i, dto.position)
                        }
                    } else {
                        let player = Player(
                            id: dto.id, name: dto.name, color: dto.color,
                            accountId: dto.accountId?.lowercased(), updatedAt: dto.updatedAt
                        )
                        game.players.insert(player, at: min(dto.position, game.players.count))
                    }
                }
            }
        }

        let entriesByGame = Dictionary(grouping: response.changes.scoreEntries, by: \.gameId)
        for (gameId, dtos) in entriesByGame where !busyGames.contains(gameId) {
            updateGame(gameId, markingDirty: false) { game in
                for dto in dtos {
                    if let i = game.log.firstIndex(where: { $0.id == dto.id }) {
                        if game.log[i].undoneAt == nil { game.log[i].undoneAt = dto.undoneAt }
                    } else {
                        game.log.append(ScoreEntry(
                            id: dto.id, playerId: dto.playerId, delta: dto.delta,
                            createdAt: dto.createdAt, undoneAt: dto.undoneAt
                        ))
                    }
                }
                game.log.sort { $0.createdAt < $1.createdAt }
            }
        }

        // Geen toegang meer (vertrokken, ontkoppeld, eigenaar weg): lokaal weg.
        let removed = Set(response.removedGameIds)
        games.removeAll { removed.contains($0.id) }
        for id in removed { sync.dirtyGames[id] = nil }

        for account in response.accounts { sync.accountNames[account.id.lowercased()] = account.displayName }
        linkSavedPlayers()
        sync.cursor = response.cursor
    }

    /// Spelers in gedeelde spellen krijgen een bewaarde speler (voor de statistiek),
    /// en een gekoppeld account wordt bij de bewaarde speler onthouden.
    private mutating func linkSavedPlayers() {
        for gi in games.indices {
            for pi in games[gi].players.indices where games[gi].players[pi].savedPlayerId == nil {
                let player = games[gi].players[pi]
                if let si = savedPlayers.firstIndex(where: { $0.name.caseInsensitiveCompare(player.name) == .orderedSame }) {
                    games[gi].players[pi].savedPlayerId = savedPlayers[si].id
                    if savedPlayers[si].accountId == nil, let account = player.accountId {
                        savedPlayers[si].accountId = account
                    }
                } else {
                    let saved = SavedPlayer(name: player.name, color: player.color, accountId: player.accountId)
                    savedPlayers.append(saved)
                    games[gi].players[pi].savedPlayerId = saved.id
                }
            }
        }
    }

    /// Bij uitloggen: sync-status wissen; de spellen blijven lokaal staan.
    public mutating func resetSync() {
        sync = SyncState()
    }
}
