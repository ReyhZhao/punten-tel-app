import React, { useState } from 'react';
import { Theme } from '../types';
import { relTime } from '../store';
import { ApiError } from '../sync';
import { useSyncApi } from '../useSync';
import Btn from './ui/Btn';
import Sheet, { Field, Hint } from './ui/Sheet';

interface Props {
  theme: Theme;
  onClose: () => void;
}

/**
 * Account aanmaken of inloggen met een code per e-mail, en daarna beheren
 * (ADR-0003). Optioneel: zonder account werkt alles lokaal.
 */
export default function AccountSheet({ theme, onClose }: Props) {
  const sync = useSyncApi();
  return (
    <Sheet theme={theme} title="Account" onClose={onClose}>
      {sync.account ? <SignedIn theme={theme} /> : <SignIn theme={theme} />}
    </Sheet>
  );
}

function SignIn({ theme: t }: { theme: Theme }) {
  const sync = useSyncApi();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      await sync.requestCode(email.trim(), needsName ? name.trim() : undefined);
      setStep('code');
      setCode('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'account_not_found') setNeedsName(true);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sync.verify(email.trim(), value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <>
        <Hint theme={t}>
          We hebben een code van 6 cijfers gestuurd naar <b>{email.trim()}</b>. De code is 15 minuten geldig.
        </Hint>
        <Field
          theme={t}
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(v);
            if (v.length === 6) verify(v);
          }}
          style={{ fontSize: 28, letterSpacing: 6, fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center' }}
        />
        {error && <Hint theme={t} error>{error}</Hint>}
        <Btn theme={t} full onClick={() => verify(code)} disabled={code.length !== 6 || busy}>Bevestigen</Btn>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={t} size="sm" variant="soft" onClick={send} disabled={busy} style={{ flex: 1 }}>Nieuwe code</Btn>
          <Btn theme={t} size="sm" variant="soft" onClick={() => { setStep('email'); setError(null); }} style={{ flex: 1 }}>
            Ander e-mailadres
          </Btn>
        </div>
      </>
    );
  }

  const canSend = email.trim() !== '' && (!needsName || name.trim() !== '') && !busy;
  return (
    <>
      <Hint theme={t}>
        {needsName
          ? 'Nieuw account. Je schermnaam zien medespelers als je ze uitnodigt.'
          : 'Met een account kun je spellen delen met medespelers en op meerdere toestellen gebruiken. Je krijgt een code per e-mail; een wachtwoord is niet nodig.'}
      </Hint>
      <Field
        theme={t}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder="E-mailadres"
        value={email}
        autoFocus
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && canSend) send(); }}
      />
      {needsName && (
        <Field
          theme={t}
          autoComplete="nickname"
          placeholder="Schermnaam"
          value={name}
          autoFocus
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSend) send(); }}
        />
      )}
      {error && <Hint theme={t} error>{error}</Hint>}
      <Btn theme={t} full onClick={send} disabled={!canSend}>
        {needsName ? 'Account aanmaken' : 'Stuur code'}
      </Btn>
    </>
  );
}

function SignedIn({ theme: t }: { theme: Theme }) {
  const sync = useSyncApi();
  const account = sync.account!;
  const [name, setName] = useState(account.displayName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === account.displayName) return;
    try { await sync.updateDisplayName(trimmed); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const status = sync.status;
  return (
    <>
      <Hint theme={t}>Ingelogd als <b>{account.email}</b>. Medespelers vinden je via dit e-mailadres.</Hint>
      <Field theme={t} value={name} maxLength={40} placeholder="Schermnaam"
        onChange={(e) => setName(e.target.value)} onBlur={saveName}
        onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} />
      <Btn theme={t} full variant="soft" size="md" onClick={sync.syncNow} disabled={status.kind === 'syncing'}>
        {status.kind === 'syncing' ? 'Bezig met synchroniseren…' : 'Nu synchroniseren'}
      </Btn>
      {status.kind === 'failed' ? (
        <Hint theme={t} error>{status.message}</Hint>
      ) : sync.lastSyncAt ? (
        <Hint theme={t}>Laatst gesynchroniseerd: {relTime(sync.lastSyncAt)}</Hint>
      ) : null}
      {error && <Hint theme={t} error>{error}</Hint>}
      <Btn theme={t} full variant="soft" size="md" onClick={sync.signOut}>Uitloggen</Btn>
      {confirmDelete ? (
        <>
          <Hint theme={t} error>
            Je account en je gedeelde spellen worden van de server verwijderd. Medespelers zien je spellen dan niet
            meer. Op dit toestel blijven ze staan.
          </Hint>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn theme={t} size="md" variant="soft" onClick={() => setConfirmDelete(false)} style={{ flex: 1 }}>Annuleer</Btn>
            <Btn theme={t} size="md" variant="danger" style={{ flex: 1 }} onClick={async () => {
              try { await sync.deleteAccount(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
            }}>Verwijderen</Btn>
          </div>
        </>
      ) : (
        <Btn theme={t} full variant="ghost" size="md" onClick={() => setConfirmDelete(true)} style={{ color: '#FF453A' }}>
          Account verwijderen
        </Btn>
      )}
      <Hint theme={t}>Na uitloggen blijven je spellen op dit toestel staan.</Hint>
    </>
  );
}
