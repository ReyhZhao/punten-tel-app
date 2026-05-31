export type Scoring = 'high' | 'low';

export interface SavedPlayer {
  id: string;
  name: string;
  color: string;
  wins: number;
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
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  finishRound: boolean;
  pendingFinish: boolean;
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
  finishRound: boolean;
  sortPlayers: boolean;
}

export interface AppState {
  games: Game[];
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
  screen: Screen;
  currentId: string | null;
}

export interface GameDraft {
  name: string;
  scoring: Scoring;
  timerOn: boolean;
  timerSecs: number;
  maxScore: number | null;
  finishRound: boolean;
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
}
