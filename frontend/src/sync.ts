/**
 * Sync met de backend (backend/README.md, ADR-0003). Zelfde gedrag als
 * ios/PuntentellerKit/Sources/PuntentellerKit/Sync.swift:
 * - gewijzigde spellen en profielen gaan als platte lijsten mee;
 * - het antwoord is de waarheid, behalve voor records die tijdens de sync
 *   lokaal opnieuw zijn gewijzigd (die gaan bij de volgende sync mee).
 *
 * De API draait op hetzelfde domein (/api/v1), dus zonder CORS.
 */
import { AppState, Game, GameProfile, LogEntry, Player, SyncState } from './types';
import { canScore, isOwner, recompute } from './store';
import { newId } from './ids';

const API = '/api/v1/';

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface Account { id: string; email: string; displayName: string }

export class ApiError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
  }
}

export async function api<T>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('offline', 'Geen verbinding met de server. Probeer het later opnieuw.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('unauthorized', 'Je bent uitgelogd. Log opnieuw in.', 401);
    // `{code, detail}` of DRF-validatie `{veld: [melding]}`.
    const first = data && typeof data === 'object' ? Object.values(data)[0] : null;
    const message = data?.detail ?? (Array.isArray(first) ? first[0] : null)
      ?? (res.status === 429 ? 'Te veel verzoeken. Probeer het later opnieuw.' : `Er ging iets mis (${res.status}).`);
    throw new ApiError(data?.code ?? `http_${res.status}`, message, res.status);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Wire-formaat
// ---------------------------------------------------------------------------

interface Rules {
  scoring: 'high' | 'low'; timerOn: boolean; timerSecs: number; maxScore: number | null;
  maxRounds: number | null; endMode: Game['endMode']; sortPlayers: boolean;
}
interface GameDTO {
  id: string; ownerId?: string | null; name: string; profileId: string | null; rules: Rules;
  endTurnsLeft: number | null; participantsCanScore: boolean; createdAt: string; updatedAt: string;
  finishedAt: string | null; deletedAt: string | null;
}
interface PlayerDTO {
  id: string; gameId: string; name: string; color: string; position: number; accountId: string | null; updatedAt: string;
}
interface EntryDTO {
  id: string; gameId: string; playerId: string; delta: number; createdAt: string; undoneAt: string | null; createdBy?: string | null;
}
interface ProfileDTO {
  id: string; ownerId?: string | null; name: string; rules: Rules; updatedAt: string; deletedAt: string | null;
}
interface Changes { games: GameDTO[]; players: PlayerDTO[]; scoreEntries: EntryDTO[]; gameProfiles: ProfileDTO[] }

export interface SyncResponse {
  cursor: number;
  changes: Changes;
  removedGameIds: string[];
  accounts: { id: string; displayName: string }[];
  rejected: { type: string; id: string; reason: string }[];
}

export interface SyncSnapshot { games: Record<string, number>; profiles: Record<string, number> }

const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: string | null | undefined) => (s == null ? null : Date.parse(s));

const rulesOf = (g: Game | GameProfile): Rules => ({
  scoring: g.scoring, timerOn: g.timerOn, timerSecs: g.timerSecs, maxScore: g.maxScore ?? null,
  maxRounds: g.maxRounds ?? null, endMode: g.endMode, sortPlayers: g.sortPlayers,
});

// ---------------------------------------------------------------------------
// Verzoek opbouwen
// ---------------------------------------------------------------------------

export function buildSyncRequest(st: AppState, me: string | null) {
  const changes: Changes = { games: [], players: [], scoreEntries: [], gameProfiles: [] };
  const { dirtyGames, dirtyProfiles } = st.sync;

  for (const p of st.gameProfiles) {
    if (dirtyProfiles[p.id] == null || (p.ownerId && p.ownerId !== me)) continue;
    changes.gameProfiles.push({
      id: p.id, name: p.name.slice(0, 80), rules: rulesOf(p),
      updatedAt: iso(p.updatedAt ?? Date.now())!, deletedAt: iso(p.deletedAt),
    });
  }
  for (const g of st.games) {
    if (dirtyGames[g.id] == null) continue;
    changes.games.push({
      id: g.id, name: g.name.slice(0, 80), profileId: g.profileId, rules: rulesOf(g),
      endTurnsLeft: g.endTurnsLeft ?? null, participantsCanScore: !!g.participantsCanScore,
      createdAt: iso(g.createdAt)!, updatedAt: iso(g.lastPlayed)!,
      finishedAt: g.finished ? iso(g.lastPlayed) : null, deletedAt: iso(g.deletedAt),
    });
    // Spelers wijzigt alleen de eigenaar; deelnemers sturen alleen boekingen.
    if (isOwner(g, me)) {
      g.players.forEach((p, i) => changes.players.push({
        id: p.id, gameId: g.id, name: p.name.slice(0, 40), color: p.color, position: i,
        accountId: p.accountId ?? null, updatedAt: iso(p.updatedAt ?? g.createdAt)!,
      }));
    }
    if (canScore(g, me)) {
      for (const e of g.log) {
        changes.scoreEntries.push({
          id: e.id, gameId: g.id, playerId: e.playerId, delta: e.delta,
          createdAt: iso(e.ts)!, undoneAt: iso(e.undoneAt),
        });
      }
    }
  }
  const snapshot: SyncSnapshot = { games: { ...dirtyGames }, profiles: { ...dirtyProfiles } };
  return { request: { cursor: st.sync.cursor, changes }, snapshot };
}

// ---------------------------------------------------------------------------
// Antwoord toepassen
// ---------------------------------------------------------------------------

export function applySyncResponse(st: AppState, r: SyncResponse, sent: SyncSnapshot): AppState {
  // Wat ongewijzigd is sinds het verzenden, is nu verwerkt.
  const dirtyGames = { ...st.sync.dirtyGames };
  const dirtyProfiles = { ...st.sync.dirtyProfiles };
  for (const [id, v] of Object.entries(sent.games)) if (dirtyGames[id] === v) delete dirtyGames[id];
  for (const [id, v] of Object.entries(sent.profiles)) if (dirtyProfiles[id] === v) delete dirtyProfiles[id];
  const busy = (id: string) => dirtyGames[id] != null;

  // Profielen
  let gameProfiles = [...st.gameProfiles];
  for (const d of r.changes.gameProfiles) {
    if (dirtyProfiles[d.id] != null) continue;
    const p: GameProfile = {
      id: d.id, name: d.name, ...d.rules, maxScore: d.rules.maxScore ?? null, maxRounds: d.rules.maxRounds ?? null,
      updatedAt: ms(d.updatedAt) ?? Date.now(), deletedAt: ms(d.deletedAt), ownerId: d.ownerId ?? null,
    };
    const i = gameProfiles.findIndex((x) => x.id === d.id);
    gameProfiles = i >= 0 ? gameProfiles.map((x, j) => (j === i ? p : x)) : [...gameProfiles, p];
  }

  // Spellen
  const games = new Map(st.games.map((g) => [g.id, g]));
  for (const d of r.changes.games) {
    if (busy(d.id)) continue;
    const old = games.get(d.id);
    games.set(d.id, {
      ...(old ?? { players: [], log: [] }),
      id: d.id, name: d.name, profileId: d.profileId,
      scoring: d.rules.scoring, timerOn: d.rules.timerOn, timerSecs: d.rules.timerSecs,
      maxScore: d.rules.maxScore ?? null, maxRounds: d.rules.maxRounds ?? null,
      endMode: d.rules.endMode, sortPlayers: d.rules.sortPlayers,
      endTurnsLeft: d.endTurnsLeft, participantsCanScore: d.participantsCanScore,
      createdAt: ms(d.createdAt)!, lastPlayed: ms(d.updatedAt)!,
      finished: d.finishedAt != null, deletedAt: ms(d.deletedAt), ownerId: d.ownerId ?? null,
    } as Game);
  }
  const byGame = <T extends { gameId: string }>(list: T[]) =>
    list.reduce<Record<string, T[]>>((acc, x) => ((acc[x.gameId] ??= []).push(x), acc), {});

  for (const [gameId, dtos] of Object.entries(byGame(r.changes.players))) {
    const g = games.get(gameId);
    if (!g || busy(gameId)) continue;
    const players: Player[] = [...g.players];
    for (const d of [...dtos].sort((a, b) => a.position - b.position)) {
      const i = players.findIndex((p) => p.id === d.id);
      const p: Player = { ...(i >= 0 ? players[i] : { score: 0 }), id: d.id, name: d.name, color: d.color,
        accountId: d.accountId, updatedAt: ms(d.updatedAt)! };
      if (i >= 0) players.splice(i, 1);
      players.splice(Math.min(d.position, players.length), 0, p);
    }
    games.set(gameId, { ...g, players });
  }

  for (const [gameId, dtos] of Object.entries(byGame(r.changes.scoreEntries))) {
    const g = games.get(gameId);
    if (!g || busy(gameId)) continue;
    const log: LogEntry[] = [...g.log];
    for (const d of dtos) {
      const i = log.findIndex((e) => e.id === d.id);
      if (i >= 0) {
        if (!log[i].undoneAt && d.undoneAt) log[i] = { ...log[i], undoneAt: ms(d.undoneAt) };
      } else {
        log.push({ id: d.id, playerId: d.playerId, delta: d.delta, ts: ms(d.createdAt)!, undoneAt: ms(d.undoneAt) });
      }
    }
    log.sort((a, b) => a.ts - b.ts);
    games.set(gameId, { ...g, log });
  }

  // Geen toegang meer: lokaal weg.
  for (const id of r.removedGameIds) {
    games.delete(id);
    delete dirtyGames[id];
  }

  const accountNames = { ...st.sync.accountNames };
  for (const a of r.accounts) accountNames[a.id] = a.displayName;

  // Spelers van gedeelde spellen worden bewaarde spelers (statistiek, snel uitnodigen).
  const savedPlayers = [...st.savedPlayers];
  for (const g of games.values()) {
    for (const p of g.players) {
      const i = savedPlayers.findIndex((sp) => sp.name.toLowerCase() === p.name.toLowerCase());
      if (i < 0) savedPlayers.push({ id: newId(), name: p.name, color: p.color, wins: 0, accountId: p.accountId ?? null });
      else if (!savedPlayers[i].accountId && p.accountId) savedPlayers[i] = { ...savedPlayers[i], accountId: p.accountId };
    }
  }

  const sync: SyncState = { cursor: r.cursor, dirtyGames, dirtyProfiles, accountNames };
  const list = st.games.filter((g) => games.has(g.id)).map((g) => recompute(games.get(g.id)!));
  const added = [...games.values()].filter((g) => !st.games.some((x) => x.id === g.id)).map(recompute);
  const removedCurrent = st.currentId && !games.has(st.currentId);
  return {
    ...st, games: [...added, ...list], gameProfiles, savedPlayers, sync,
    ...(removedCurrent ? { screen: 'home' as const, currentId: null } : {}),
  };
}

/** Alles opnieuw versturen (na inloggen): lokale spellen en eigen profielen. */
export function markEverything(st: AppState): AppState {
  const dirtyGames: Record<string, number> = {};
  const dirtyProfiles: Record<string, number> = {};
  for (const g of st.games) dirtyGames[g.id] = 1;
  for (const p of st.gameProfiles) if (!p.ownerId) dirtyProfiles[p.id] = 1;
  return { ...st, sync: { cursor: null, dirtyGames, dirtyProfiles, accountNames: {} } };
}
