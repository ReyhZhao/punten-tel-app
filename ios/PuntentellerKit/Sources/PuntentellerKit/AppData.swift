import Foundation

/// Een speler bij het aanmaken van een spel; met `accountId` is hij uitgenodigd.
public struct NewPlayer: Hashable, Sendable {
    public var name: String
    public var accountId: String?

    public init(name: String, accountId: String? = nil) {
        self.name = name
        self.accountId = accountId
    }
}

/// Alle gegevens die op het toestel bewaard worden en (met een account) gesynct.
/// Lokale UI-state hoort hier niet in (ADR-0002).
public struct AppData: Codable, Hashable, Sendable {
    public var games: [Game]
    public var savedPlayers: [SavedPlayer]
    public var gameProfiles: [GameProfile]
    /// Wat nog naar de backend moet, en tot waar we bij zijn (Sync.swift).
    public var sync: SyncState

    public init(games: [Game] = [], savedPlayers: [SavedPlayer] = [], gameProfiles: [GameProfile] = []) {
        self.games = games
        self.savedPlayers = savedPlayers
        self.gameProfiles = gameProfiles
        self.sync = SyncState()
    }

    // Ontbrekende sleutels zijn een lege lijst, zodat oudere bestanden blijven laden.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        games = try c.decodeIfPresent([Game].self, forKey: .games) ?? []
        savedPlayers = try c.decodeIfPresent([SavedPlayer].self, forKey: .savedPlayers) ?? []
        gameProfiles = try c.decodeIfPresent([GameProfile].self, forKey: .gameProfiles) ?? []
        sync = try c.decodeIfPresent(SyncState.self, forKey: .sync) ?? SyncState()
    }

    /// Spellen voor het startscherm: niet verwijderd, laatst gespeeld eerst.
    public var visibleGames: [Game] {
        games.filter { !$0.isDeleted }.sorted { $0.lastPlayed > $1.lastPlayed }
    }

    public func game(_ id: UUID) -> Game? { games.first { $0.id == id } }

    /// Maakt een nieuw spel en onthoudt de spelers die nog niet bewaard zijn
    /// (op naam, hoofdletterongevoelig, zoals `createGame` in de PWA).
    @discardableResult
    public mutating func startGame(
        name: String,
        rules: GameRules,
        playerNames: [String],
        profileId: UUID? = nil,
        at now: Date = .now
    ) -> Game {
        startGame(name: name, rules: rules, players: playerNames.map { NewPlayer(name: $0) }, profileId: profileId, at: now)
    }

    /// Variant met uitgenodigde spelers. Het account-id wordt ook bij de
    /// bewaarde speler onthouden, zodat je die de volgende keer direct uitnodigt.
    @discardableResult
    public mutating func startGame(
        name: String,
        rules: GameRules,
        players newPlayers: [NewPlayer],
        profileId: UUID? = nil,
        participantsCanScore: Bool = false,
        at now: Date = .now
    ) -> Game {
        var game = Game.start(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            profileId: profileId,
            rules: rules,
            players: newPlayers.map {
                Player(name: $0.name.trimmingCharacters(in: .whitespacesAndNewlines), color: "", accountId: $0.accountId)
            },
            at: now
        )
        game.participantsCanScore = participantsCanScore
        for i in game.players.indices {
            let p = game.players[i]
            if let si = savedPlayers.firstIndex(where: { $0.name.caseInsensitiveCompare(p.name) == .orderedSame }) {
                game.players[i].savedPlayerId = savedPlayers[si].id
                if let account = p.accountId, savedPlayers[si].accountId != account {
                    savedPlayers[si].accountId = account
                    savedPlayers[si].updatedAt = now
                }
            } else {
                let saved = SavedPlayer(name: p.name, color: p.color, accountId: p.accountId, updatedAt: now)
                savedPlayers.append(saved)
                game.players[i].savedPlayerId = saved.id
            }
        }
        games.append(game)
        markDirty(game: game.id)
        return game
    }

    /// Onthoud bij een bewaarde speler welk account erbij hoort (na opzoeken op e-mail).
    public mutating func setAccount(_ accountId: String?, forSavedPlayerNamed name: String) {
        guard let i = savedPlayers.firstIndex(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) else { return }
        savedPlayers[i].accountId = accountId
        savedPlayers[i].updatedAt = .now
    }

    /// Spelprofielen die niet verwijderd zijn, in volgorde van aanmaken.
    public var visibleProfiles: [GameProfile] { gameProfiles.filter { $0.deletedAt == nil } }

    /// Profiel met deze naam (hoofdletterongevoelig, spaties eromheen genegeerd).
    public func profile(named name: String) -> GameProfile? {
        let key = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return nil }
        return visibleProfiles.first { $0.name.caseInsensitiveCompare(key) == .orderedSame }
    }

    /// Bewaart spelregels als profiel. Bestaat er al een profiel met die naam,
    /// dan krijgt dat de nieuwe spelregels.
    @discardableResult
    public mutating func saveProfile(name: String, rules: GameRules, at now: Date = .now) -> GameProfile {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if let existing = profile(named: trimmed), existing.ownerId == nil,
           let i = gameProfiles.firstIndex(where: { $0.id == existing.id }) {
            gameProfiles[i].rules = rules
            gameProfiles[i].updatedAt = now
            markDirty(profile: existing.id)
            return gameProfiles[i]
        }
        let profile = GameProfile(name: trimmed, rules: rules, updatedAt: now)
        gameProfiles.append(profile)
        markDirty(profile: profile.id)
        return profile
    }

    /// Start een nieuw spel met dezelfde spelregels en spelers (ADR-0002).
    @discardableResult
    public mutating func rematch(_ gameId: UUID, at now: Date = .now) -> Game? {
        guard let game = game(gameId) else { return nil }
        let next = game.rematch(at: now)
        games.append(next)
        markDirty(game: next.id)
        return next
    }

    /// Past een spel aan en geeft het resultaat van `body` terug; nil als het spel
    /// niet bestaat. Markeert het spel als gewijzigd voor de sync (behalve als
    /// de wijziging zelf van de server komt).
    @discardableResult
    public mutating func updateGame<T>(_ id: UUID, markingDirty: Bool = true, _ body: (inout Game) -> T) -> T? {
        guard let i = games.firstIndex(where: { $0.id == id }) else { return nil }
        let result = body(&games[i])
        if markingDirty { markDirty(game: id) }
        return result
    }
}
