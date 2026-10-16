import React, { useState } from 'react';
import { Theme } from '../types';
import { useSyncApi } from '../useSync';
import Btn from './ui/Btn';
import Sheet, { Field, Hint } from './ui/Sheet';

interface Props {
  theme: Theme;
  playerName: string;
  accountId: string | null | undefined;
  onChange: (accountId: string | null) => void;
  onClose: () => void;
}

/** Een speler uitnodigen door zijn account te zoeken op het volledige e-mailadres. */
export default function InviteSheet({ theme: t, playerName, accountId, onChange, onClose }: Props) {
  const sync = useSyncApi();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<{ id: string; displayName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setError(null);
    setFound(null);
    setBusy(true);
    try {
      setFound(await sync.lookup(email.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet theme={t} title={`${playerName} uitnodigen`} onClose={onClose}>
      {accountId && !found && (
        <>
          <Hint theme={t}><span style={{ color: '#34C759', fontWeight: 600 }}>{playerName} is uitgenodigd.</span></Hint>
          <Btn theme={t} full size="md" variant="soft" onClick={() => { onChange(null); onClose(); }}>
            Uitnodiging intrekken
          </Btn>
        </>
      )}
      <Hint theme={t}>
        Vul het volledige e-mailadres in waarmee {playerName} een Puntenteller-account heeft. Na uitnodigen ziet{' '}
        {playerName} dit spel en de uitslag in de eigen app.
      </Hint>
      <Field
        theme={t}
        type="email"
        autoComplete="off"
        autoCapitalize="none"
        placeholder={`E-mailadres van ${playerName}`}
        value={email}
        autoFocus
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) search(); }}
      />
      <Btn theme={t} full size="md" variant="soft" onClick={search} disabled={!email.trim() || busy}>
        {busy ? 'Zoeken…' : 'Zoeken'}
      </Btn>
      {error && <Hint theme={t} error>{error}</Hint>}
      {found && (
        <Btn theme={t} full onClick={() => { onChange(found.id); onClose(); }}>
          {playerName} koppelen aan {found.displayName}
        </Btn>
      )}
    </Sheet>
  );
}
