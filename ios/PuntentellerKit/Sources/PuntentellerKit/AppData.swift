import Foundation

/// Alle gegevens die op het toestel bewaard worden (en straks gesynct).
/// Lokale UI-state hoort hier niet in (ADR-0002).
public struct AppData: Codable, Hashable, Sendable {
    public var games: [Game]
    public var savedPlayers: [SavedPlayer]
    public var gameProfiles: [GameProfile]

    public init(games: [Game] = [], savedPlayers: [SavedPlayer] = [], gameProfiles: [GameProfile] = []) {
        self.games = games
        self.savedPlayers = savedPlayers
        self.gameProfiles = gameProfiles
    }

    // Ontbrekende sleutels zijn een lege lijst, zodat oudere bestanden blijven laden.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        games = try c.decodeIfPresent([Game].self, forKey: .games) ?? []
        savedPlayers = try c.decodeIfPresent([SavedPlayer].self, forKey: .savedPlayers) ?? []
        gameProfiles = try c.decodeIfPresent([GameProfile].self, forKey: .gameProfiles) ?? []
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
        var game = Game.start(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            profileId: profileId,
            rules: rules,
            players: playerNames.map { Player(name: $0.trimmingCharacters(in: .whitespacesAndNewlines), color: "") },
            at: now
        )
        for i in game.players.indices {
            let p = game.players[i]
            if let saved = savedPlayers.first(where: { $0.name.caseInsensitiveCompare(p.name) == .orderedSame }) {
                game.players[i].savedPlayerId = saved.id
            } else {
                let saved = SavedPlayer(name: p.name, color: p.color, updatedAt: now)
                savedPlayers.append(saved)
                game.players[i].savedPlayerId = saved.id
            }
        }
        games.append(game)
        return game
    }

    /// Past een spel aan en geeft het resultaat van `body` terug; nil als het spel niet bestaat.
    @discardableResult
    public mutating func updateGame<T>(_ id: UUID, _ body: (inout Game) -> T) -> T? {
        guard let i = games.firstIndex(where: { $0.id == id }) else { return nil }
        return body(&games[i])
    }
}
