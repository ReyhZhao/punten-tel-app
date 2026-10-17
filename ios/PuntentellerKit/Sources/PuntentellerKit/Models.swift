import Foundation

// Domeinmodel van de Puntenteller. Begrippen: zie CONTEXT.md.
// Sync-klaar opgezet volgens docs/adr/0002-sync-klaar-datamodel.md:
// UUID's die de client aanmaakt, het logboek als bron van waarheid,
// tombstones in plaats van verwijderen en `updatedAt` op alles wat kan wijzigen.

public enum Scoring: String, Codable, Sendable, CaseIterable {
    /// Hoogste score wint.
    case high
    /// Laagste score wint.
    case low
}

/// Wat er gebeurt zodra de maximale score bereikt is.
public enum EndMode: String, Codable, Sendable, CaseIterable {
    /// Het spel stopt direct.
    case immediate
    /// De huidige ronde wordt afgemaakt: spelers ná de trigger spelen hun beurt nog.
    case round
    /// Alle andere spelers krijgen nog precies één beurt (bv. Duizendbommen).
    case extraTurn
}

/// Hoe een spel gespeeld wordt. Gedeeld door `Game` en `GameProfile`.
public struct GameRules: Codable, Hashable, Sendable {
    public var scoring: Scoring
    public var timerOn: Bool
    public var timerSecs: Int
    public var maxScore: Int?
    /// Maximaal aantal rondes (een ronde = elke speler één boeking). nil = geen limiet.
    public var maxRounds: Int?
    public var endMode: EndMode
    public var sortPlayers: Bool

    public init(
        scoring: Scoring = .high,
        timerOn: Bool = false,
        timerSecs: Int = 60,
        maxScore: Int? = nil,
        maxRounds: Int? = nil,
        endMode: EndMode = .immediate,
        sortPlayers: Bool = true
    ) {
        self.scoring = scoring
        self.timerOn = timerOn
        self.timerSecs = timerSecs
        self.maxScore = maxScore
        self.maxRounds = maxRounds
        self.endMode = endMode
        self.sortPlayers = sortPlayers
    }
}

/// Deelnemer aan één spel. De stand wordt afgeleid uit het logboek van het spel.
public struct Player: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var name: String
    /// Hex-kleur, bv. `#FF5A5F`. Zie `PlayerColors`.
    public var color: String
    /// De bewaarde speler waar deze speler van komt, als die er is.
    public var savedPlayerId: UUID?
    /// Account in de backend; blijft nil tot een uitgenodigde speler accepteert.
    public var accountId: String?
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        name: String,
        color: String,
        savedPlayerId: UUID? = nil,
        accountId: String? = nil,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.savedPlayerId = savedPlayerId
        self.accountId = accountId
        self.updatedAt = updatedAt
    }
}

/// Eén boeking. Verandert nooit, alleen `undoneAt` kan nog gezet worden.
public struct ScoreEntry: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public let playerId: UUID
    /// Mag 0 zijn: dan telt de beurt mee voor de rondetelling.
    public let delta: Int
    public let createdAt: Date
    public var undoneAt: Date?

    public var isActive: Bool { undoneAt == nil }

    public init(id: UUID = UUID(), playerId: UUID, delta: Int, createdAt: Date = .now, undoneAt: Date? = nil) {
        self.id = id
        self.playerId = playerId
        self.delta = delta
        self.createdAt = createdAt
        self.undoneAt = undoneAt
    }
}

public struct Game: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var name: String
    /// Het spelprofiel waar dit spel van komt, of nil bij een los spel.
    public var profileId: UUID?
    public var rules: GameRules
    public var players: [Player]
    public var log: [ScoreEntry]
    /// Resterende beurten nadat de max score bereikt is. nil = nog niet getriggerd.
    public var endTurnsLeft: Int?
    public let createdAt: Date
    public var updatedAt: Date
    public var finishedAt: Date?
    public var deletedAt: Date?
    /// Account van de eigenaar (backend). nil = van jezelf, nog niet gesynct.
    public var ownerId: String?
    /// Gekoppelde spelers mogen ook scores bijhouden (ADR-0003).
    public var participantsCanScore: Bool
    /// Invoer op eigen speler: na een boeking springt de invoer terug naar je eigen speler.
    public var stayOnOwnPlayer: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        profileId: UUID? = nil,
        rules: GameRules,
        players: [Player],
        log: [ScoreEntry] = [],
        endTurnsLeft: Int? = nil,
        createdAt: Date = .now,
        updatedAt: Date? = nil,
        finishedAt: Date? = nil,
        deletedAt: Date? = nil,
        ownerId: String? = nil,
        participantsCanScore: Bool = false,
        stayOnOwnPlayer: Bool = false
    ) {
        self.id = id
        self.name = name
        self.profileId = profileId
        self.rules = rules
        self.players = players
        self.log = log
        self.endTurnsLeft = endTurnsLeft
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
        self.finishedAt = finishedAt
        self.deletedAt = deletedAt
        self.ownerId = ownerId
        self.participantsCanScore = participantsCanScore
        self.stayOnOwnPlayer = stayOnOwnPlayer
    }

    // Velden die later zijn toegevoegd, zijn optioneel bij het decoderen,
    // zodat oudere opslagbestanden blijven laden.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        profileId = try c.decodeIfPresent(UUID.self, forKey: .profileId)
        rules = try c.decode(GameRules.self, forKey: .rules)
        players = try c.decode([Player].self, forKey: .players)
        log = try c.decode([ScoreEntry].self, forKey: .log)
        endTurnsLeft = try c.decodeIfPresent(Int.self, forKey: .endTurnsLeft)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        finishedAt = try c.decodeIfPresent(Date.self, forKey: .finishedAt)
        deletedAt = try c.decodeIfPresent(Date.self, forKey: .deletedAt)
        ownerId = try c.decodeIfPresent(String.self, forKey: .ownerId)
        participantsCanScore = try c.decodeIfPresent(Bool.self, forKey: .participantsCanScore) ?? false
        stayOnOwnPlayer = try c.decodeIfPresent(Bool.self, forKey: .stayOnOwnPlayer) ?? false
    }

    public var isFinished: Bool { finishedAt != nil }
    public var isDeleted: Bool { deletedAt != nil }
    /// Tijdstip van de laatste wijziging; de lijst op het startscherm sorteert hierop.
    public var lastPlayed: Date { updatedAt }
}

public struct GameProfile: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var name: String
    public var rules: GameRules
    public var updatedAt: Date
    public var deletedAt: Date?
    /// Account van de eigenaar. nil = van jezelf. Profielen van anderen komen
    /// mee met een gedeeld spel en zijn alleen-lezen.
    public var ownerId: String?

    public init(
        id: UUID = UUID(), name: String, rules: GameRules, updatedAt: Date = .now,
        deletedAt: Date? = nil, ownerId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.rules = rules
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.ownerId = ownerId
    }
}

/// Speler die op dit toestel onthouden wordt. Gewonnen spellen worden afgeleid
/// via `Statistics` en niet als teller opgeslagen.
public struct SavedPlayer: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var name: String
    public var color: String
    public var accountId: String?
    public var updatedAt: Date
    /// Overwinningen uit de PWA die niet uit geïmporteerde spellen af te leiden
    /// zijn (bv. spellen die daar door "Opnieuw spelen" overschreven zijn).
    public var importedWins: Int
    /// Idem per spelprofiel, gesleuteld op `GameProfile.id.uuidString`.
    public var importedProfileWins: [String: Int]

    public init(
        id: UUID = UUID(),
        name: String,
        color: String,
        accountId: String? = nil,
        updatedAt: Date = .now,
        importedWins: Int = 0,
        importedProfileWins: [String: Int] = [:]
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.accountId = accountId
        self.updatedAt = updatedAt
        self.importedWins = importedWins
        self.importedProfileWins = importedProfileWins
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        color = try c.decode(String.self, forKey: .color)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        importedWins = try c.decodeIfPresent(Int.self, forKey: .importedWins) ?? 0
        importedProfileWins = try c.decodeIfPresent([String: Int].self, forKey: .importedProfileWins) ?? [:]
    }
}

/// Vaste spelerkleuren, in deze volgorde toegekend (gelijk aan frontend/src/theme.ts).
public enum PlayerColors {
    public static let all = [
        "#FF5A5F", "#FF8A3D", "#F4B400", "#34C759",
        "#00C2C7", "#4D8DFF", "#8B6CFF", "#FF6FB5",
    ]

    public static func color(at index: Int) -> String { all[index % all.count] }
}
