import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../types';
import { formatInviteCode, inviteQrPayload, qrPath } from '../inviteCode';
import { useSyncApi } from '../useSync';
import Btn from './ui/Btn';
import { Hint } from './ui/Sheet';

/**
 * Eigen uitnodigcode tonen, als cijfers en als QR-code. Een verlopen code wordt
 * vanzelf vervangen zolang de kaart open staat.
 */
export default function InviteCodeCard({ theme: t }: { theme: Theme }) {
  const sync = useSyncApi();
  const [invite, setInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const renew = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const r = await sync.inviteCode();
      setInvite({ code: r.code, expiresAt: Date.parse(r.expiresAt) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => { renew(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = invite ? Math.max(0, Math.round((invite.expiresAt - now) / 1000)) : 0;
  useEffect(() => {
    if (invite && left === 0) renew();
  }, [invite, left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <>
        <Hint theme={t} error>{error}</Hint>
        <Btn theme={t} full size="md" variant="soft" onClick={renew}>Opnieuw proberen</Btn>
      </>
    );
  }
  if (!invite) return <Hint theme={t}>Code ophalen…</Hint>;

  const qr = qrPath(inviteQrPayload(invite.code));
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 18,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      {/* Altijd zwart op wit: zo scant elke camera hem, ook in donkere modus. */}
      <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} width={200} height={200}
        style={{ background: '#fff', borderRadius: 12 }} shapeRendering="crispEdges" aria-label="QR-code">
        <path d={qr.path} fill="#000" />
      </svg>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, letterSpacing: 4, color: t.text,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatInviteCode(invite.code)}
      </div>
      <Hint theme={t}>Nog {m}:{s} geldig. Laat een medespeler deze code invullen of scannen bij Uitnodigen.</Hint>
      <Btn theme={t} size="sm" variant="ghost" onClick={renew}>Nieuwe code</Btn>
    </div>
  );
}
