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
  score: number;
}

export interface LogEntry {
  id: string;
  playerId: string;
  delta: number;
  ts: number;
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
  endMode: EndMode;
  /** Resterend aantal beurten voordat het spel eindigt, nadat de max bereikt is. null = nog niet getriggerd. */
  endTurnsLeft: number | null;
  sortPlayers: boolean;
  players: Player[];
  log: LogEntry[];
  createdAt: number;
  lastPlayed: number;
  finished: boolean;
}

export interface GameProfile {
  id: string;
  name: string;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  endMode: EndMode;
  sortPlayers: boolean;
}

export interface AppState {
  games: Game[];
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
  screen: Screen;
  currentId: string | null;
  keepAwake: boolean;
}

export interface GameDraft {
  name: string;
  profileId: string | null;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  endMode: EndMode;
  sortPlayers: boolean;
  players: Player[];
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
}
