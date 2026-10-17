import React, { useState } from 'react';
import { Actions, Game, Theme } from '../types';
import { useSyncApi } from '../useSync';
import Btn from './ui/Btn';
import PlayerAvatar from './ui/PlayerAvatar';
import Sheet, { Hint } from './ui/Sheet';
import InviteSheet from './InviteSheet';

interface Props {
  theme: Theme;
  game: Game;
  actions: Actions;
  onClose: () => void;
}

/**
 * Eigenaar van een lopend spel: spelers uitnodigen, iedereen laten scoren en
 * het spel overdragen aan een andere speler (ADR-0003).
 */
export default function ShareSheet({ theme: t, game, actions, onClose }: Props) {
  const sync = useSyncApi();
  const me = sync.accountId;
  // Zonder account is er geen "jij" (anders zou elke niet-gekoppelde speler matchen).
  const myPlayer = me ? game.players.find((p) => p.accountId === me) : undefined;
  const candidates = game.players.filter((p) => p.accountId && p.accountId !== me);
  const [inviting, setInviting] = useState<string | null>(null);
  const [newOwner, setNewOwner] = useState<string>('');
  const [ownPlayer, setOwnPlayer] = useState<string>('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = { fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: t.muted };
  const select = {
    height: 48, borderRadius: 14, border: `1px solid ${t.border}`, background: t.surface, color: t.text,
    padding: '0 12px', fontSize: 16, width: '100%',
  };
  const invitedPlayer = game.players.find((p) => p.id === inviting);
  const canTransfer = !!newOwner && (!!myPlayer || !!ownPlayer) && !busy;

  const transfer = async () => {
    setError(null);
    setBusy(true);
    try {
      await sync.transfer(game.id, newOwner, myPlayer ? null : ownPlayer);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <Sheet theme={t} title="Spelers en delen" onClose={onClose}>
        <div style={label}>Spelers</div>
        {game.players.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface,
            borderRadius: 16, border: `1px solid ${t.border}`, padding: '8px 10px 8px 12px' }}>
            <PlayerAvatar player={p} size={34} theme={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: t.text }}>{p.name}</div>
              {p.accountId && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#34C759' }}>
                  {p.accountId === me ? 'Jij' : `Uitgenodigd: ${sync.accountName(p.accountId) ?? p.name}`}
                </div>
              )}
            </div>
            {p.accountId ? (
              <Btn theme={t} size="sm" variant="soft" onClick={() => actions.linkPlayer(game.id, p.id, null)}>
                {p.accountId === me ? 'Niet ik' : 'Intrekken'}
              </Btn>
            ) : (
              <>
                {!myPlayer && (
                  <Btn theme={t} size="sm" variant="soft" onClick={() => actions.linkPlayer(game.id, p.id, me)}>Dit ben ik</Btn>
                )}
                <Btn theme={t} size="sm" variant="soft" onClick={() => setInviting(p.id)}>Uitnodigen</Btn>
              </>
            )}
          </div>
        ))}
        <Hint theme={t}>Uitgenodigde spelers zien dit spel en de stand in hun eigen app.</Hint>

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Alle spelers mogen scores invoeren</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>Uitgenodigde spelers kunnen dan ook punten boeken</div>
          </div>
          <input
            type="checkbox"
            checked={!!game.participantsCanScore}
            onChange={(e) => actions.setParticipantsCanScore(game.id, e.target.checked)}
            style={{ width: 24, height: 24, accentColor: '#34C759' }}
          />
        </label>
        {game.participantsCanScore && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Invoer op eigen speler</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                Iedereen boekt op de eigen telefoon; na een boeking springt de invoer terug naar je eigen speler
              </div>
            </div>
            <input
              type="checkbox"
              checked={!!game.stayOnOwnPlayer}
              onChange={(e) => actions.setStayOnOwnPlayer(game.id, e.target.checked)}
              style={{ width: 24, height: 24, accentColor: '#34C759' }}
            />
          </label>
        )}

        <div style={{ ...label, marginTop: 8 }}>Eigenaar overdragen</div>
        {candidates.length === 0 ? (
          <Hint theme={t}>Nodig eerst een speler uit; daarna kun je het spel aan die speler overdragen.</Hint>
        ) : (
          <>
            <select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} style={select} aria-label="Nieuwe eigenaar">
              <option value="">Kies de nieuwe eigenaar</option>
              {candidates.map((p) => <option key={p.id} value={p.accountId!}>{p.name}</option>)}
            </select>
            {!myPlayer && (
              <select value={ownPlayer} onChange={(e) => setOwnPlayer(e.target.value)} style={select} aria-label="Welke speler ben jij?">
                <option value="">Welke speler ben jij?</option>
                {game.players.filter((p) => !p.accountId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {confirm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn theme={t} size="md" variant="soft" onClick={() => setConfirm(false)} style={{ flex: 1 }}>Annuleer</Btn>
                <Btn theme={t} size="md" onClick={transfer} disabled={busy} style={{ flex: 1 }}>
                  {busy ? 'Bezig…' : 'Ja, overdragen'}
                </Btn>
              </div>
            ) : (
              <Btn theme={t} full size="md" onClick={() => setConfirm(true)} disabled={!canTransfer}>Eigenaar overdragen</Btn>
            )}
            {error && <Hint theme={t} error>{error}</Hint>}
            <Hint theme={t}>De nieuwe eigenaar beheert daarna het spel en de spelers. Jij blijft meespelen en ziet de stand.</Hint>
          </>
        )}
      </Sheet>
      {invitedPlayer && (
        <InviteSheet
          theme={t}
          playerName={invitedPlayer.name}
          accountId={invitedPlayer.accountId}
          onClose={() => setInviting(null)}
          onChange={(accountId) => actions.linkPlayer(game.id, invitedPlayer.id, accountId)}
        />
      )}
    </>
  );
}
