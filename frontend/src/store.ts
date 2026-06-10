import { useState, useEffect } from 'react';
import { AppState, EndMode, Game, GameDraft, GameProfile, SavedPlayer } from './types';
import { PLAYER_COLORS } from './theme';

// Oude opslag gebruikte een boolean `finishRound`; vertaal die naar de nieuwe EndMode.
function migrateEndMode(o: { endMode?: EndMode; finishRound?: boolean }): EndMode {
  if (o.endMode === 'immediate' || o.endMode === 'round' || o.endMode === 'extraTurn') return o.endMode;
  return o.finishRound ? 'round' : 'immediate';
}

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
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      return {
        ...parsed,
        games: (parsed.games ?? []).map((g) => ({
          ...g,
          endMode: migrateEndMode(g),
          endTurnsLeft: g.endTurnsLeft ?? null,
        })),
        gameProfiles: (parsed.gameProfiles ?? []).map((p) => ({
          ...p,
          endMode: migrateEndMode(p),
        })),
      };
    }
  } catch {
    // ignore
  }
  return { games: [], savedPlayers: [], gameProfiles: [], screen: 'home', currentId: null, keepAwake: false };
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

  const addWin = (saved: SavedPlayer[], winnerName: string): SavedPlayer[] =>
    saved.map((sp) =>
      sp.name.toLowerCase() === winnerName.toLowerCase()
        ? { ...sp, wins: (sp.wins ?? 0) + 1 }
        : sp
    );

  const gameWinner = (g: Game): string | null => {
    if (!g.players.length) return null;
    return [...g.players].sort((a, b) =>
      g.scoring === 'low' ? a.score - b.score : b.score - a.score
    )[0].name;
  };

  const actions = {
    goHome: () => setSt((s) => ({ ...s, screen: 'home', currentId: null })),
    goPlayers: () => setSt((s) => ({ ...s, screen: 'players' })),
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
        maxScore: draft.maxScore,
        endMode: draft.endMode,
        sortPlayers: draft.sortPlayers,
        endTurnsLeft: null,
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
      setSt((s) => {
        const saved: SavedPlayer[] = [...(s.savedPlayers ?? [])];
        for (const p of game.players) {
          if (!saved.some((sp) => sp.name.toLowerCase() === p.name.toLowerCase())) {
            saved.push({ id: uid(), name: p.name, color: p.color, wins: 0 });
          }
        }
        return { ...s, games: [game, ...s.games], savedPlayers: saved, currentId: id, screen: 'scoring' };
      });
    },

    openGame: (id: string) =>
      setSt((s) => {
        const g = s.games.find((x) => x.id === id);
        return { ...s, currentId: id, screen: g?.finished ? 'winner' : 'scoring' };
      }),

    applyScore: (gameId: string, playerId: string, delta: number) =>
      setSt((s) => {
        let finishNow = false;
        let winnerName: string | null = null;
        const updatedGames = s.games.map((g) => {
          if (g.id !== gameId) return g;
          const newPlayers = g.players.map((p) =>
            p.id === playerId ? { ...p, score: p.score + delta } : p
          );
          const newLog = [...g.log, { id: uid(), playerId, delta, ts: Date.now() }];
          let updated: Game = { ...g, lastPlayed: Date.now(), players: newPlayers, log: newLog };
          const maxScore = g.maxScore ?? null;

          const finish = () => {
            updated = { ...updated, finished: true, endTurnsLeft: null };
            finishNow = true;
            winnerName = gameWinner(updated);
          };

          if (maxScore != null) {
            if (g.endTurnsLeft == null) {
              // Nog niet getriggerd: kijk of de max nu bereikt wordt.
              const triggered = newPlayers.some((p) => p.score >= maxScore);
              if (triggered) {
                if (g.endMode === 'immediate') {
                  finish();
                } else {
                  const n = g.players.length;
                  const triggerIdx = g.players.findIndex((p) => p.id === playerId);
                  // 'round': alleen spelers ná de trigger maken de ronde af.
                  // 'extraTurn': alle overige spelers krijgen nog één beurt.
                  const left = g.endMode === 'extraTurn' ? n - 1 : n - 1 - triggerIdx;
                  if (left <= 0) finish();
                  else updated = { ...updated, endTurnsLeft: left };
                }
              }
            } else {
              // Al getriggerd: deze beurt telt mee in de aftelling.
              const left = g.endTurnsLeft - 1;
              if (left <= 0) finish();
              else updated = { ...updated, endTurnsLeft: left };
            }
          }
          return updated;
        });
        const saved = finishNow && winnerName
          ? addWin(s.savedPlayers ?? [], winnerName)
          : (s.savedPlayers ?? []);
        return { ...s, games: updatedGames, savedPlayers: saved, ...(finishNow ? { screen: 'winner' as const } : {}) };
      }),

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
      setSt((s) => {
        const game = s.games.find((g) => g.id === gameId);
        const winner = game ? gameWinner(game) : null;
        const saved = winner ? addWin(s.savedPlayers ?? [], winner) : (s.savedPlayers ?? []);
        return {
          ...s,
          screen: 'winner',
          savedPlayers: saved,
          games: s.games.map((g) =>
            g.id === gameId ? { ...g, finished: true, lastPlayed: Date.now() } : g
          ),
        };
      }),

    rematch: (gameId: string) =>
      setSt((s) => ({
        ...s,
        screen: 'scoring',
        games: s.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                finished: false,
                endTurnsLeft: null,
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

    saveProfile: (profile: GameProfile) =>
      setSt((s) => ({
        ...s,
        gameProfiles: [...(s.gameProfiles ?? []), profile],
      })),

    setKeepAwake: (on: boolean) => setSt((s) => ({ ...s, keepAwake: on })),
  };

  return { st, actions };
}
