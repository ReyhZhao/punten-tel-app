import React, { useState, useRef } from 'react';
import { Theme, Actions, Player } from '../../types';
import { PLAYER_COLORS } from '../../theme';
import { uid } from '../../store';
import IconBtn from '../ui/IconBtn';
import Icon from '../ui/Icon';
import Btn from '../ui/Btn';
import PlayerAvatar from '../ui/PlayerAvatar';

interface Props {
  theme: Theme;
  actions: Actions;
}

export default function NewGameScreen({ theme, actions }: Props) {
  const t = theme;
  const [name, setName] = useState('');
  const [scoring, setScoring] = useState<'high' | 'low'>('high');
  const [timerOn, setTimerOn] = useState(false);
  const [timerSecs, setTimerSecs] = useState(60);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addPlayer = () => {
    const nm = draft.trim();
    if (!nm || players.length >= 8) return;
    setPlayers((ps) => [
      ...ps,
      { id: uid(), name: nm, color: PLAYER_COLORS[ps.length % PLAYER_COLORS.length], score: 0 },
    ]);
    setDraft('');
    inputRef.current?.focus();
  };

  const removePlayer = (id: string) =>
    setPlayers((ps) =>
      ps
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }))
    );

  const canStart = name.trim().length > 0 && players.length >= 2;

  const SegBtn = ({ value, label, icon }: { value: 'high' | 'low'; label: string; icon: 'up' | 'down' }) => {
    const active = scoring === value;
    return (
      <button
        onClick={() => setScoring(value)}
        style={{
          flex: 1,
          height: 44,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          background: active ? t.surface : 'transparent',
          color: active ? t.text : t.muted,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          transition: 'all .15s',
        }}
      >
        <Icon name={icon} size={17} style={{ color: active ? t.accent : t.muted }} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:
            'max(52px, calc(env(safe-area-inset-top) + 16px)) 16px 6px',
        }}
      >
        <IconBtn theme={t} name="x" onClick={actions.goHome} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 17,
            color: t.text,
          }}
        >
          Nieuw spel
        </span>
        <div style={{ width: 44 }} />
      </div>

      {/* Scrollable form */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 18px 130px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {/* Game name */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.muted,
              margin: '0 0 8px 4px',
            }}
          >
            Naam van het spel
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="bijv. Spelavond, Rummikub…"
            style={{
              width: '100%',
              height: 54,
              padding: '0 18px',
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              background: t.surface,
              color: t.text,
              fontSize: 18,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              outline: 'none',
            }}
          />
        </div>

        {/* Scoring */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.muted,
              margin: '0 0 8px 4px',
            }}
          >
            Wie wint?
          </label>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 5,
              background: t.surface2,
              borderRadius: 15,
            }}
          >
            <SegBtn value="high" label="Hoogste wint" icon="up" />
            <SegBtn value="low" label="Laagste wint" icon="down" />
          </div>
        </div>

        {/* Timer */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 4px 0',
            }}
          >
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Timer per beurt
            </label>
            <button
              onClick={() => setTimerOn((v) => !v)}
              style={{
                border: 'none',
                cursor: 'pointer',
                width: 52,
                height: 31,
                borderRadius: 16,
                padding: 2,
                background: timerOn ? '#34C759' : t.faint,
                transition: 'background .2s',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: timerOn ? 'translateX(21px)' : 'translateX(0)',
                  transition: 'transform .2s',
                }}
              />
            </button>
          </div>
          {timerOn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {[30, 45, 60, 90].map((s) => (
                <button
                  key={s}
                  onClick={() => setTimerSecs(s)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 13,
                    border: 'none',
                    cursor: 'pointer',
                    background: timerSecs === s ? t.accent : t.surface2,
                    color: timerSecs === s ? t.accentText : t.text,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {s}s
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Players */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0 4px 8px',
            }}
          >
            <label
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
              }}
            >
              Spelers
            </label>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: players.length >= 8 ? t.accent : t.faint,
                fontFamily: 'var(--font-display)',
              }}
            >
              {players.length}/8
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: '8px 10px 8px 12px',
                }}
              >
                <PlayerAvatar player={p} size={36} theme={t} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 16.5,
                    fontWeight: 500,
                    color: t.text,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {p.name}
                </span>
                <IconBtn
                  theme={t}
                  name="trash"
                  size={36}
                  iconSize={18}
                  onClick={() => removePlayer(p.id)}
                  bg="transparent"
                  color={t.faint}
                />
              </div>
            ))}

            {players.length < 8 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: t.surface2,
                  borderRadius: 16,
                  padding: '6px 6px 6px 14px',
                }}
              >
                <Icon name="person" size={20} style={{ color: t.faint }} />
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
                  placeholder="Naam speler toevoegen"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 16.5,
                    color: t.text,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    minWidth: 0,
                  }}
                />
                <IconBtn
                  theme={t}
                  name="plus"
                  size={38}
                  iconSize={22}
                  onClick={addPlayer}
                  bg={draft.trim() ? t.accent : t.faint}
                  color={t.accentText}
                  disabled={!draft.trim()}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding:
            'max(16px, env(safe-area-inset-bottom)) 18px max(34px, calc(env(safe-area-inset-bottom) + 16px))',
          background: `linear-gradient(to top, ${t.bg} 60%, transparent)`,
        }}
      >
        <Btn
          theme={t}
          full
          size="lg"
          disabled={!canStart}
          onClick={() =>
            actions.createGame({ name: name.trim(), scoring, timerOn, timerSecs, players })
          }
        >
          <Icon name="flag" size={20} /> Start spel
        </Btn>
        {!canStart && (
          <div
            style={{ textAlign: 'center', fontSize: 12.5, color: t.muted, marginTop: 8 }}
          >
            Geef een naam op en voeg minstens 2 spelers toe
          </div>
        )}
      </div>
    </div>
  );
}
