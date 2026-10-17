import React, { useState } from 'react';
import { Theme } from '../types';
import { canScanQr, parseInviteCode } from '../inviteCode';
import { useSyncApi } from '../useSync';
import QrScanner from './QrScanner';
import Btn from './ui/Btn';
import Sheet, { Field, Hint } from './ui/Sheet';

interface Props {
  theme: Theme;
  playerName: string;
  accountId: string | null | undefined;
  onChange: (accountId: string | null) => void;
  onClose: () => void;
}

/**
 * Een speler uitnodigen door zijn account te zoeken op het volledige e-mailadres
 * of op de uitnodigcode die hij in Account toont (getypt of als QR-code gescand).
 */
export default function InviteSheet({ theme: t, playerName, accountId, onChange, onClose }: Props) {
  const sync = useSyncApi();
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<{ id: string; displayName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (text = query) => {
    const code = parseInviteCode(text);
    setError(null);
    setFound(null);
    setBusy(true);
    try {
      setFound(await sync.lookup(code ? { code } : { email: text.trim() }));
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
        Vul de uitnodigcode in die {playerName} bij Account ziet, of het volledige e-mailadres van het account. Na
        uitnodigen ziet {playerName} dit spel en de uitslag in de eigen app.
      </Hint>
      {scanning ? (
        <QrScanner theme={t} onCode={(code) => { setScanning(false); setQuery(code); search(code); }} />
      ) : (
        <Field
          theme={t}
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Uitnodigcode of e-mailadres"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            // Een volledige code meteen opzoeken.
            if (parseInviteCode(e.target.value) && !busy) search(e.target.value);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) search(); }}
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn theme={t} size="md" variant="soft" onClick={() => search()} disabled={!query.trim() || busy}
          style={{ flex: 1 }}>
          {busy ? 'Zoeken…' : 'Zoeken'}
        </Btn>
        {canScanQr && (
          <Btn theme={t} size="md" variant="soft" onClick={() => setScanning(!scanning)} style={{ flex: 1 }}>
            {scanning ? 'Stop scannen' : 'Scan QR-code'}
          </Btn>
        )}
      </div>
      {error && <Hint theme={t} error>{error}</Hint>}
      {found && (
        <Btn theme={t} full onClick={() => { onChange(found.id); onClose(); }}>
          {playerName} koppelen aan {found.displayName}
        </Btn>
      )}
    </Sheet>
  );
}
