export type Scoring = 'high' | 'low';

/**
 * Wat er gebeurt zodra de maximale score bereikt is:
 * - 'immediate'  : spel stopt direct
 * - 'round'      : huidige ronde afmaken (spelers ná de trigger spelen hun beurt nog)
 * - 'extraTurn'  : alle overige spelers krijgen nog precies één beurt (bv. Duizendbommen)
 */
export type EndMode = 'immediate' | 'round' | 'extraTurn';

export interface SavedPlayer {
  id: string;
  name: string;
  color: string;
  /** Totaal aantal gewonnen spellen, over alle speltypes heen. */
  wins: number;
  /** Aantal overwinningen per spelprofiel, gesleuteld op profiel-id. */
  profileWins?: Record<string, number>;
  /** Account (backend) van deze speler, na opzoeken op e-mail; voor sneller uitnodigen. */
  accountId?: string | null;
}

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentText: string;
  border: string;
  sep: string;
  shadow: string;
  glow: string;
}
export type Screen = 'home' | 'new' | 'scoring' | 'winner' | 'players';

export interface Player {
  id: string;
  name: string;
  color: string;
  /** Afgeleid uit de actieve boekingen (zie `recompute` in store.ts). */
  score: number;
  /** Gekoppeld account: uitgenodigde speler (ADR-0003). */
  accountId?: string | null;
  updatedAt?: number;
}

export interface LogEntry {
  id: string;
  playerId: string;
  delta: number;
  ts: number;
  /** Ingetrokken (undo/reset). Boekingen blijven als tombstone bewaard voor de sync. */
  undoneAt?: number | null;
}

export interface Game {
  id: string;
  name: string;
  /** Het spelprofiel waaruit dit spel is aangemaakt, of null bij een los spel. */
  profileId: string | null;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  /** Maximaal aantal rondes (een ronde = elke speler één score-actie). null = geen limiet. */
  maxRounds: number | null;
  endMode: EndMode;
  /** Resterend aantal beurten voordat het spel eindigt, nadat de max bereikt is. null = nog niet getriggerd. */
  endTurnsLeft: number | null;
  sortPlayers: boolean;
  players: Player[];
  log: LogEntry[];
  createdAt: number;
  /** Laatste wijziging; dient ook als `updatedAt` voor de sync. */
  lastPlayed: number;
  finished: boolean;
  /** Account van de eigenaar (backend). null = van jezelf, nog niet gesynct. */
  ownerId?: string | null;
  /** Uitgenodigde spelers mogen ook scores bijhouden. */
  participantsCanScore?: boolean;
  /** Invoer op eigen speler: na een boeking springt de invoer terug naar je eigen speler. */
  stayOnOwnPlayer?: boolean;
  /** Verwijderd (tombstone). */
  deletedAt?: number | null;
}

export interface GameProfile {
  id: string;
  name: string;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  maxRounds: number | null;
  endMode: EndMode;
  sortPlayers: boolean;
  updatedAt?: number;
  deletedAt?: number | null;
  /** Eigenaar; profielen van anderen komen mee met een gedeeld spel (alleen-lezen). */
  ownerId?: string | null;
}

/** Wat nog naar de backend moet, en tot waar we bij zijn (sync.ts). */
export interface SyncState {
  cursor: number | null;
  /** Lokaal gewijzigd, nog niet verstuurd: id → teller die bij elke wijziging ophoogt. */
  dirtyGames: Record<string, number>;
  dirtyProfiles: Record<string, number>;
  /** Schermnamen van accounts (eigenaren, gekoppelde spelers). */
  accountNames: Record<string, string>;
}

export interface AppState {
  games: Game[];
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
  screen: Screen;
  currentId: string | null;
  keepAwake: boolean;
  /** Bewaarde speler die jij bent; komt automatisch in elk nieuw spel. */
  myPlayerId?: string | null;
  sync: SyncState;
}

export interface GameDraft {
  name: string;
  profileId: string | null;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  maxRounds: number | null;
  endMode: EndMode;
  sortPlayers: boolean;
  players: Player[];
  participantsCanScore?: boolean;
  stayOnOwnPlayer?: boolean;
}

export interface Actions {
  goHome: () => void;
  goPlayers: () => void;
  startNewGame: () => void;
  createGame: (draft: GameDraft) => void;
  openGame: (id: string) => void;
  applyScore: (gameId: string, playerId: string, delta: number) => void;
  undoLog: (gameId: string, logId: string) => void;
  finishGame: (gameId: string) => void;
  rematch: (gameId: string) => void;
  resetScores: (gameId: string) => void;
  deleteGame: (gameId: string) => void;
  saveProfile: (profile: GameProfile) => void;
  setKeepAwake: (on: boolean) => void;
  /** Kies welke bewaarde speler jij bent (null = niemand). */
  setMyPlayer: (savedPlayerId: string | null) => void;
  /** Onthoud het account bij een bewaarde speler (na opzoeken op e-mail). */
  rememberAccount: (playerName: string, accountId: string | null) => void;
  setParticipantsCanScore: (gameId: string, on: boolean) => void;
  setStayOnOwnPlayer: (gameId: string, on: boolean) => void;
  linkPlayer: (gameId: string, playerId: string, accountId: string | null) => void;
}
