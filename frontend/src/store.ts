import { useState, useEffect } from 'react';
import { AppState, Game, GameDraft } from './types';
import { PLAYER_COLORS } from './theme';

const STORE_KEY = 'pwa-punten-v2';
let _seq = 0;
export const uid = () =>
  Date.now().toString(36) + (_seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'zojuist';
  if (s < 90) return '1 min geleden';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gisteren';
  if (d < 7) return `${d} dagen geleden`;
  return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { games: [], screen: 'home', currentId: null };
}

export function useAppState() {
  const [st, setSt] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
    } catch {
      // ignore storage errors
    }
  }, [st]);

  const updateGame = (id: string, fn: (g: Game) => Game) =>
    setSt((s) => ({ ...s, games: s.games.map((g) => (g.id === id ? fn(g) : g)) }));

  const actions = {
    goHome: () => setSt((s) => ({ ...s, screen: 'home', currentId: null })),
    startNewGame: () => setSt((s) => ({ ...s, screen: 'new' })),

    createGame: (draft: GameDraft) => {
      const id = uid();
      const now = Date.now();
      const game: Game = {
        id,
        name: draft.name,
        scoring: draft.scoring,
        timerOn: draft.timerOn,
        timerSecs: draft.timerSecs,
        players: draft.players.map((p, i) => ({
          ...p,
          score: 0,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        })),
        log: [],
        createdAt: now,
        lastPlayed: now,
        finished: false,
      };
      setSt((s) => ({ ...s, games: [game, ...s.games], currentId: id, screen: 'scoring' }));
    },

    openGame: (id: string) =>
      setSt((s) => {
        const g = s.games.find((x) => x.id === id);
        return { ...s, currentId: id, screen: g?.finished ? 'winner' : 'scoring' };
      }),

    applyScore: (gameId: string, playerId: string, delta: number) =>
      updateGame(gameId, (g) => ({
        ...g,
        lastPlayed: Date.now(),
        players: g.players.map((p) =>
          p.id === playerId ? { ...p, score: p.score + delta } : p
        ),
        log: [...g.log, { id: uid(), playerId, delta, ts: Date.now() }],
      })),

    undoLog: (gameId: string, logId: string) =>
      updateGame(gameId, (g) => {
        const entry = g.log.find((e) => e.id === logId);
        if (!entry) return g;
        return {
          ...g,
          lastPlayed: Date.now(),
          players: g.players.map((p) =>
            p.id === entry.playerId ? { ...p, score: p.score - entry.delta } : p
          ),
          log: g.log.filter((e) => e.id !== logId),
        };
      }),

    finishGame: (gameId: string) =>
      setSt((s) => ({
        ...s,
        screen: 'winner',
        games: s.games.map((g) =>
          g.id === gameId ? { ...g, finished: true, lastPlayed: Date.now() } : g
        ),
      })),

    rematch: (gameId: string) =>
      setSt((s) => ({
        ...s,
        screen: 'scoring',
        games: s.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                finished: false,
                lastPlayed: Date.now(),
                players: g.players.map((p) => ({ ...p, score: 0 })),
                log: [],
              }
            : g
        ),
      })),

    resetScores: (gameId: string) =>
      updateGame(gameId, (g) => ({
        ...g,
        players: g.players.map((p) => ({ ...p, score: 0 })),
        log: [],
      })),

    deleteGame: (gameId: string) =>
      setSt((s) => ({
        ...s,
        games: s.games.filter((g) => g.id !== gameId),
        screen: 'home',
        currentId: null,
      })),
  };

  return { st, actions };
}
