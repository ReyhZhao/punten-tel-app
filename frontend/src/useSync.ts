import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from './types';
import { emptySync } from './store';
import { Account, ApiError, api, applySyncResponse, buildSyncRequest, markEverything, SyncResponse } from './sync';

const SESSION_KEY = 'pwa-punten-account';

interface Session { token: string; account: Account }

export type SyncStatus = { kind: 'idle' } | { kind: 'syncing' } | { kind: 'failed'; message: string };

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Account en sync met de backend. Zonder account gebeurt er niets en werkt de
 * app lokaal. Sync: na een wijziging (2 s vertraagd), elke 20 s zolang de
 * pagina zichtbaar is, en bij terugkeren naar de app.
 */
export function useSync(st: AppState, setSt: (fn: (s: AppState) => AppState) => void) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const stRef = useRef(st);
  stRef.current = st;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const inFlight = useRef(false);
  const again = useRef(false);

  const saveSession = (s: Session | null) => {
    setSession(s);
    sessionRef.current = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const clearSession = useCallback(() => {
    saveSession(null);
    setLastSyncAt(null);
    setSt((s) => ({ ...s, sync: emptySync() }));
  }, [setSt]);

  const syncNow = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setStatus({ kind: 'syncing' });
    try {
      do {
        again.current = false;
        const { request, snapshot } = buildSyncRequest(stRef.current, current.account.id);
        const response = await api<SyncResponse>('POST', 'sync', request, current.token);
        // Direct ook de ref bijwerken, zodat een herhaalronde de nieuwe cursor gebruikt.
        stRef.current = applySyncResponse(stRef.current, response, snapshot);
        setSt((s) => applySyncResponse(s, response, snapshot));
        setLastSyncAt(Date.now());
      } while (again.current);
      setStatus({ kind: 'idle' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') clearSession();
      setStatus({ kind: 'failed', message: e instanceof Error ? e.message : 'Synchroniseren mislukt.' });
    } finally {
      inFlight.current = false;
    }
  }, [setSt, clearSession]);

  // Na een lokale wijziging: 2 s later syncen (snel tikken wordt één sync).
  const pendingKey = JSON.stringify([st.sync.dirtyGames, st.sync.dirtyProfiles]);
  useEffect(() => {
    if (!session || pendingKey === '[{},{}]') return;
    const t = setTimeout(syncNow, 2000);
    return () => clearTimeout(t);
  }, [pendingKey, session, syncNow]);

  // Periodiek en bij terugkeren naar de app.
  useEffect(() => {
    if (!session) return;
    const tick = () => { if (document.visibilityState === 'visible') syncNow(); };
    tick();
    const interval = setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [session, syncNow]);

  const token = session?.token ?? null;

  return {
    account: session?.account ?? null,
    accountId: session?.account.id ?? null,
    status,
    lastSyncAt,
    syncNow,

    requestCode: (email: string, displayName?: string) =>
      api<{ sent: boolean; newAccount: boolean }>('POST', 'auth/request-code', {
        email, ...(displayName ? { displayName } : {}),
      }),

    verify: async (email: string, code: string) => {
      const r = await api<{ token: string; account: Account }>('POST', 'auth/verify', {
        email, code, deviceName: 'Web-app',
      });
      // Alles wat lokaal staat, gaat bij de eerste sync mee.
      setSt(markEverything);
      saveSession(r);
    },

    updateDisplayName: async (displayName: string) => {
      const account = await api<Account>('PATCH', 'me', { displayName }, token);
      if (sessionRef.current) saveSession({ ...sessionRef.current, account });
    },

    signOut: async () => {
      try { await api('POST', 'auth/logout', undefined, token); } catch { /* toch uitloggen */ }
      clearSession();
      setStatus({ kind: 'idle' });
    },

    deleteAccount: async () => {
      await api('DELETE', 'me', undefined, token);
      clearSession();
      setStatus({ kind: 'idle' });
    },

    lookup: (email: string) =>
      api<{ id: string; displayName: string }>('POST', 'accounts/lookup', { email }, token),

    /** Eigenaar overdragen. Eerst syncen (net uitgenodigde spelers), daarna opnieuw. */
    transfer: async (gameId: string, accountId: string, ownerPlayerId?: string | null) => {
      await syncNow();
      await api('POST', `games/${gameId}/transfer`, { accountId, ownerPlayerId: ownerPlayerId ?? null }, token);
      await syncNow();
    },

    leave: async (gameId: string) => {
      await api('POST', `games/${gameId}/leave`, undefined, token);
      setSt((s) => ({ ...s, games: s.games.filter((g) => g.id !== gameId), screen: 'home', currentId: null }));
    },

    accountName: (id: string | null | undefined) => (id ? st.sync.accountNames[id] ?? null : null),
  };
}

export type SyncApi = ReturnType<typeof useSync>;

export const SyncContext = createContext<SyncApi | null>(null);

export function useSyncApi(): SyncApi {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncApi buiten SyncContext');
  return ctx;
}
