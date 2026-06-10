import React, { useState, useEffect } from 'react';
import { Theme, Game, Actions } from '../../types';
import { uid } from '../../store';
import Icon from '../ui/Icon';
import IconBtn from '../ui/IconBtn';
import PlayerAvatar from '../ui/PlayerAvatar';
import TurnTimer from '../game/TurnTimer';
import HistorySheet from '../game/HistorySheet';
import ActionSheet from '../game/ActionSheet';

interface FloatEntry {
  key: string;
  playerId: string;
  delta: number;
}

interface Props {
  theme: Theme;
  game: Game;
  actions: Actions;
}

export default function ScoringScreen({ theme, game, actions }: Props) {
  const t = theme;
  const [amount, setAmount] = useState('1');
  const [selectedId, setSelectedId] = useState<string | null>(game.players[0]?.id ?? null);
  const [floats, setFloats] = useState<FloatEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [turnIdx, setTurnIdx] = useState(0);
  const [remaining, setRemaining] = useState(game.timerSecs || 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!game.timerOn || !running) return;
    if (remaining <= 0) { setRunning(false); return; }
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, game.timerOn]);

  const turnPlayer = game.players[turnIdx] ?? game.players[0];

  const nextTurn = () => {
    const ni = (turnIdx + 1) % game.players.length;
    setTurnIdx(ni);
    setRemaining(game.timerSecs || 60);
    setRunning(true);
    setSelectedId(game.players[ni].id);
  };

  const amt = Math.max(0, parseInt(amount || '0', 10) || 0);
  const selected = game.players.find((p) => p.id === selectedId) ?? game.players[0];

  const apply = (sign: number) => {
    if (!selected || amt === 0) return;
    const delta = sign * amt;
    actions.applyScore(game.id, selected.id, delta);
    const key = uid();
    setFloats((f) => [...f, { key, playerId: selected.id, delta }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 900);
    setAmount('0');
    const idx = game.players.findIndex((p) => p.id === selected.id);
    const next = game.players[(idx + 1) % game.players.length];
    setSelectedId(next.id);
    // Het einde van het spel (max bereikt, ronde afmaken, extra beurten) wordt
    // centraal in applyScore afgehandeld; die zet zo nodig het winnaarsscherm.
  };

  const ranked = game.sortPlayers
    ? [...game.players].sort((a, b) => game.scoring === 'low' ? a.score - b.score : b.score - a.score)
    : game.players;
  const leaders =
    game.log.length > 0
      ? ranked.filter((p) => p.score === ranked[0].score).map((p) => p.id)
      : [];

  const controlCard = (
    <div
      style={{
        background: t.surface,
        borderRadius: 22,
        border: `1px solid ${t.border}`,
        boxShadow: t.shadow,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 11,
          paddingLeft: 4,
        }}
      >
        <span style={{ fontSize: 13, color: t.muted }}>Punten voor</span>
        {selected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: t.surface2,
              padding: '3px 10px 3px 4px',
              borderRadius: 20,
            }}
          >
            <PlayerAvatar player={selected} size={22} theme={t} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                color: t.text,
              }}
            >
              {selected.name}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Minus button */}
        <button
          onClick={() => apply(-1)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            background: t.surface2,
            color: '#FF453A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform .1s',
          }}
          onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
          onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Icon name="minus" size={30} strokeWidth={3} />
        </button>

        {/* Amount input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            style={{
              width: '100%',
              textAlign: 'center',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 44,
              color: t.text,
              lineHeight: 1,
              padding: 0,
            }}
          />
          <span
            style={{
              fontSize: 11.5,
              color: t.muted,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            aantal punten
          </span>
        </div>

        {/* Plus button */}
        <button
          onClick={() => apply(1)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            background: t.accent,
            color: t.accentText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform .1s',
          }}
          onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
          onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Icon name="plus" size={30} strokeWidth={3} />
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: t.bg,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding:
            'max(52px, calc(env(safe-area-inset-top) + 16px)) 12px 8px',
        }}
      >
        <IconBtn theme={t} name="back" onClick={actions.goHome} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 17,
              color: t.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {game.name}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>
            {game.scoring === 'low' ? 'Laagste wint' : 'Hoogste wint'}
          </div>
        </div>
        <IconBtn theme={t} name="list" onClick={() => setHistoryOpen(true)} />
        <IconBtn theme={t} name="ellipsis" onClick={() => setMenuOpen(true)} />
      </div>

      {/* Control bar (top) */}
      <div style={{ padding: '2px 16px 10px' }}>{controlCard}</div>

      {/* Scrollable player list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 16px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {game.timerOn && turnPlayer && (
          <TurnTimer
            theme={t}
            game={game}
            turnPlayer={turnPlayer}
            remaining={remaining}
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={() => setRemaining(game.timerSecs || 60)}
            onNext={nextTurn}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {ranked.map((p) => {
            const isSel = p.id === selectedId;
            const isLeader = leaders.includes(p.id);
            const myFloats = floats.filter((f) => f.playerId === p.id);
            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  background: t.surface,
                  borderRadius: 18,
                  padding: '12px 16px 12px 14px',
                  cursor: 'pointer',
                  border: `2px solid ${isSel ? p.color : 'transparent'}`,
                  boxShadow: isSel ? `0 4px 18px ${p.color}33` : t.shadow,
                  transition: 'border-color .15s, box-shadow .15s',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <PlayerAvatar player={p} size={44} theme={t} />
                  {isLeader && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: '#F4B400',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        border: `2px solid ${t.surface}`,
                      }}
                    >
                      <Icon name="trophy" size={12} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 18,
                      color: t.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.name}
                  </div>
                  {isSel && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: p.color,
                        letterSpacing: 0.3,
                      }}
                    >
                      geselecteerd
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <span
                    key={p.score}
                    style={{
                      display: 'inline-block',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 30,
                      color: t.text,
                      fontVariantNumeric: 'tabular-nums',
                      animation: 'pop .25s ease',
                    }}
                  >
                    {p.score}
                  </span>
                  {myFloats.map((f) => (
                    <span
                      key={f.key}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: -2,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 22,
                        color: f.delta >= 0 ? '#34C759' : '#FF453A',
                        animation: 'floatUp .9s ease forwards',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.delta >= 0 ? '+' : ''}
                      {f.delta}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <HistorySheet
        theme={t}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        game={game}
        onUndo={(id) => actions.undoLog(game.id, id)}
      />
      <ActionSheet
        theme={t}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={game.name}
        actions={[
          {
            label: 'Beëindig spel & toon winnaar',
            icon: 'trophy',
            onClick: () => actions.finishGame(game.id),
          },
          {
            label: 'Historie bekijken',
            icon: 'list',
            onClick: () => setHistoryOpen(true),
          },
          {
            label: 'Scores resetten',
            icon: 'reset',
            onClick: () => actions.resetScores(game.id),
          },
          {
            label: 'Spel verwijderen',
            icon: 'trash',
            danger: true,
            onClick: () => actions.deleteGame(game.id),
          },
        ]}
      />
    </div>
  );
}
