import { useState, useEffect } from 'react';
import { AppState, EndMode, Game, GameDraft, GameProfile, LogEntry, SavedPlayer, SyncState } from './types';
import { PLAYER_COLORS } from './theme';
import { derivedId, isUuid, newId } from './ids';

// v3: sync-klaar model (ADR-0002): UUID's, tombstones, score afgeleid uit het logboek.
export const STORE_KEY = 'pwa-punten-v3';
// Oude opslag; wordt bij het laden gemigreerd en blijft als back-up staan.
const LEGACY_KEY = 'pwa-punten-v2';

export const uid = newId;

// Oude opslag gebruikte een boolean `finishRound`; vertaal die naar de nieuwe EndMode.
function migrateEndMode(o: { endMode?: EndMode; finishRound?: boolean }): EndMode {
  if (o.endMode === 'immediate' || o.endMode === 'round' || o.endMode === 'extraTurn') return o.endMode;
  return o.finishRound ? 'round' : 'immediate';
}

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

// ---------------------------------------------------------------------------
// Afgeleide waarden en rechten
// ---------------------------------------------------------------------------

/** Boekingen die nog meetellen (zonder ingetrokken). */
export const activeLog = (g: Game): LogEntry[] => g.log.filter((e) => !e.undoneAt);

/** Zet `player.score` gelijk aan de som van de actieve boekingen. */
export function recompute(g: Game): Game {
  const totals: Record<string, number> = {};
  for (const e of activeLog(g)) totals[e.playerId] = (totals[e.playerId] ?? 0) + e.delta;
  return { ...g, players: g.players.map((p) => ({ ...p, score: totals[p.id] ?? 0 })) };
}

/** Van jou: nog niet gesynct (geen eigenaar) of jij bent de eigenaar. */
export const isOwner = (g: Game, me: string | null | undefined) => !g.ownerId || g.ownerId === me;

/** Mag dit account punten boeken? De eigenaar altijd, deelnemers als dat aan staat. */
export const canScore = (g: Game, me: string | null | undefined) => isOwner(g, me) || !!g.participantsCanScore;

export const emptySync = (): SyncState => ({ cursor: null, dirtyGames: {}, dirtyProfiles: {}, accountNames: {} });

export const markGame = (s: SyncState, id: string): SyncState => ({
  ...s, dirtyGames: { ...s.dirtyGames, [id]: (s.dirtyGames[id] ?? 0) + 1 },
});

export const markProfile = (s: SyncState, id: string): SyncState => ({
  ...s, dirtyProfiles: { ...s.dirtyProfiles, [id]: (s.dirtyProfiles[id] ?? 0) + 1 },
});

// ---------------------------------------------------------------------------
// Laden en migreren
// ---------------------------------------------------------------------------

type LegacyState = Omit<Partial<AppState>, 'games'> & { games?: (Game & { finishRound?: boolean })[] };

/**
 * v2 → v3. Id's worden deterministisch afgeleid, met dezelfde afleiding als de
 * iOS-import, zodat een spel in beide apps hetzelfde id krijgt. Een opgeslagen
 * score die niet klopt met het logboek krijgt een correctieboeking (ook zoals
 * de iOS-import), zodat de stand gelijk blijft.
 */
function migrateLegacy(old: LegacyState): AppState {
  const profileIds: Record<string, string> = {};
  const gameProfiles: GameProfile[] = (old.gameProfiles ?? []).map((p) => {
    const id = isUuid(p.id) ? p.id : derivedId('profile', p.id);
    profileIds[p.id] = id;
    return { ...p, id, endMode: migrateEndMode(p), maxRounds: p.maxRounds ?? null, updatedAt: Date.now() };
  });
  const gameIds: Record<string, string> = {};
  const games: Game[] = (old.games ?? []).map((g) => {
    const key = g.id;
    const id = isUuid(key) ? key : derivedId('game', key);
    gameIds[key] = id;
    const playerIds: Record<string, string> = {};
    const players = g.players.map((p) => {
      playerIds[p.id] = isUuid(p.id) ? p.id : derivedId('player', `${key}:${p.id}`);
      return { ...p, id: playerIds[p.id], accountId: null, updatedAt: g.lastPlayed ?? g.createdAt };
    });
    const log: LogEntry[] = (g.log ?? [])
      .filter((e) => playerIds[e.playerId])
      .map((e) => ({ ...e, id: isUuid(e.id) ? e.id : derivedId('entry', `${key}:${e.id}`), playerId: playerIds[e.playerId], undoneAt: null }));
    for (const p of g.players) {
      const sum = log.filter((e) => e.playerId === playerIds[p.id]).reduce((a, e) => a + e.delta, 0);
      if (sum !== p.score) {
        log.unshift({ id: derivedId('correction', `${key}:${p.id}`), playerId: playerIds[p.id], delta: p.score - sum, ts: g.createdAt, undoneAt: null });
      }
    }
    const { finishRound: _ignored, ...rest } = g;
    return recompute({
      ...rest, id, players, log,
      profileId: g.profileId ? profileIds[g.profileId] ?? derivedId('profile', g.profileId) : null,
      endMode: migrateEndMode(g), endTurnsLeft: g.endTurnsLeft ?? null, maxRounds: g.maxRounds ?? null,
      ownerId: null, participantsCanScore: false, deletedAt: null,
    });
  });
  const savedPlayers: SavedPlayer[] = (old.savedPlayers ?? []).map((sp) => ({
    ...sp,
    id: isUuid(sp.id) ? sp.id : derivedId('saved', sp.id),
    profileWins: Object.fromEntries(Object.entries(sp.profileWins ?? {}).map(([k, v]) => [profileIds[k] ?? k, v])),
    accountId: null,
  }));
  return {
    games, savedPlayers, gameProfiles,
    screen: old.screen ?? 'home',
    currentId: old.currentId ? gameIds[old.currentId] ?? null : null,
    keepAwake: !!old.keepAwake,
    sync: emptySync(),
  };
}

const initialState = (): AppState => ({
  games: [], savedPlayers: [], gameProfiles: [], screen: 'home', currentId: null, keepAwake: false, sync: emptySync(),
});

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      return { ...initialState(), ...parsed, sync: { ...emptySync(), ...(parsed.sync ?? {}) } };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy) as LegacyState);
  } catch {
    // ignore
  }
  return initialState();
}

// ---------------------------------------------------------------------------
// Acties
// ---------------------------------------------------------------------------

export function useAppState() {
  const [st, setSt] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
    } catch {
      // ignore storage errors
    }
  }, [st]);

  /** Wijzig één spel: score opnieuw berekenen en markeren voor de sync. */
  const withGame = (s: AppState, id: string, fn: (g: Game) => Game): AppState => ({
    ...s,
    games: s.games.map((g) => (g.id === id ? recompute(fn(g)) : g)),
    sync: markGame(s.sync, id),
  });

  const addWin = (
    saved: SavedPlayer[],
    winnerName: string,
    profileId: string | null
  ): SavedPlayer[] =>
    saved.map((sp) => {
      if (sp.name.toLowerCase() !== winnerName.toLowerCase()) return sp;
      const profileWins = { ...(sp.profileWins ?? {}) };
      if (profileId) profileWins[profileId] = (profileWins[profileId] ?? 0) + 1;
      return { ...sp, wins: (sp.wins ?? 0) + 1, profileWins };
    });

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
      const id = newId();
      const now = Date.now();
      const game: Game = {
        id,
        name: draft.name,
        profileId: draft.profileId,
        scoring: draft.scoring,
        timerOn: draft.timerOn,
        timerSecs: draft.timerSecs,
        maxScore: draft.maxScore,
        maxRounds: draft.maxRounds,
        endMode: draft.endMode,
        sortPlayers: draft.sortPlayers,
        endTurnsLeft: null,
        players: draft.players.map((p, i) => ({
          ...p,
          id: isUuid(p.id) ? p.id : newId(),
          score: 0,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          accountId: p.accountId ?? null,
          updatedAt: now,
        })),
        log: [],
        createdAt: now,
        lastPlayed: now,
        finished: false,
        ownerId: null,
        participantsCanScore: !!draft.participantsCanScore,
        deletedAt: null,
      };
      setSt((s) => {
        const saved: SavedPlayer[] = [...(s.savedPlayers ?? [])];
        for (const p of game.players) {
          const i = saved.findIndex((sp) => sp.name.toLowerCase() === p.name.toLowerCase());
          if (i < 0) {
            saved.push({ id: newId(), name: p.name, color: p.color, wins: 0, accountId: p.accountId ?? null });
          } else if (p.accountId) {
            saved[i] = { ...saved[i], accountId: p.accountId };
          }
        }
        return {
          ...s, games: [game, ...s.games], savedPlayers: saved, currentId: id, screen: 'scoring',
          sync: markGame(s.sync, id),
        };
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
        let finishedProfileId: string | null = null;
        const game = s.games.find((g) => g.id === gameId);
        if (!game || game.finished) return s;
        const next = withGame(s, gameId, (g) => {
          const now = Date.now();
          const newLog = [...g.log, { id: newId(), playerId, delta, ts: now, undoneAt: null }];
          let updated: Game = recompute({ ...g, lastPlayed: now, log: newLog });
          const newPlayers = updated.players;
          const maxScore = g.maxScore ?? null;

          const finish = () => {
            updated = { ...updated, finished: true, endTurnsLeft: null };
            finishNow = true;
            winnerName = gameWinner(updated);
            finishedProfileId = g.profileId;
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

          // Harde cap op het aantal rondes: één ronde = elke speler één
          // score-actie (ingetrokken boekingen tellen niet). Eindigt het spel
          // zodra de cap bereikt is, los van de max-punten-logica.
          const maxRounds = g.maxRounds ?? null;
          if (!finishNow && maxRounds != null && activeLog(updated).length >= maxRounds * g.players.length) {
            finish();
          }
          return updated;
        });
        const saved = finishNow && winnerName
          ? addWin(s.savedPlayers ?? [], winnerName, finishedProfileId)
          : (s.savedPlayers ?? []);
        return { ...next, savedPlayers: saved, ...(finishNow ? { screen: 'winner' as const } : {}) };
      }),

    undoLog: (gameId: string, logId: string) =>
      setSt((s) => withGame(s, gameId, (g) => ({
        ...g,
        lastPlayed: Date.now(),
        log: g.log.map((e) => (e.id === logId && !e.undoneAt ? { ...e, undoneAt: Date.now() } : e)),
      }))),

    finishGame: (gameId: string) =>
      setSt((s) => {
        const game = s.games.find((g) => g.id === gameId);
        const winner = game ? gameWinner(game) : null;
        const saved = winner ? addWin(s.savedPlayers ?? [], winner, game?.profileId ?? null) : (s.savedPlayers ?? []);
        return {
          ...withGame(s, gameId, (g) => ({ ...g, finished: true, endTurnsLeft: null, lastPlayed: Date.now() })),
          screen: 'winner',
          savedPlayers: saved,
        };
      }),

    /** Nieuw spel met dezelfde regels en spelers; het afgeronde spel blijft bewaard (ADR-0002). */
    rematch: (gameId: string) =>
      setSt((s) => {
        const g = s.games.find((x) => x.id === gameId);
        if (!g) return s;
        const now = Date.now();
        const next: Game = {
          ...g,
          id: newId(),
          players: g.players.map((p) => ({ ...p, id: newId(), score: 0, updatedAt: now })),
          log: [],
          endTurnsLeft: null,
          finished: false,
          createdAt: now,
          lastPlayed: now,
          ownerId: null,
          deletedAt: null,
        };
        return { ...s, games: [next, ...s.games], currentId: next.id, screen: 'scoring', sync: markGame(s.sync, next.id) };
      }),

    resetScores: (gameId: string) =>
      setSt((s) => withGame(s, gameId, (g) => {
        const now = Date.now();
        return { ...g, lastPlayed: now, endTurnsLeft: null, log: g.log.map((e) => (e.undoneAt ? e : { ...e, undoneAt: now })) };
      })),

    deleteGame: (gameId: string) =>
      setSt((s) => ({
        ...withGame(s, gameId, (g) => ({ ...g, deletedAt: Date.now(), lastPlayed: Date.now() })),
        screen: 'home',
        currentId: null,
      })),

    saveProfile: (profile: GameProfile) =>
      setSt((s) => {
        const p = { ...profile, id: isUuid(profile.id) ? profile.id : newId(), updatedAt: Date.now() };
        return { ...s, gameProfiles: [...(s.gameProfiles ?? []), p], sync: markProfile(s.sync, p.id) };
      }),

    setKeepAwake: (on: boolean) => setSt((s) => ({ ...s, keepAwake: on })),

    rememberAccount: (playerName: string, accountId: string | null) =>
      setSt((s) => ({
        ...s,
        savedPlayers: s.savedPlayers.map((sp) =>
          sp.name.toLowerCase() === playerName.toLowerCase() ? { ...sp, accountId } : sp
        ),
      })),
  };

  return { st, setSt, actions };
}
