import React, { useState } from 'react';
import { Theme, Actions, SavedPlayer, GameProfile } from '../../types';
import IconBtn from '../ui/IconBtn';
import Icon from '../ui/Icon';

interface Props {
  theme: Theme;
  actions: Actions;
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
}

// 'total' = alle spellen samen, anders een profiel-id.
type Scope = 'total' | string;

export default function PlayersScreen({ theme, actions, savedPlayers, gameProfiles }: Props) {
  const t = theme;
  const [scope, setScope] = useState<Scope>('total');

  const winsFor = (p: SavedPlayer) =>
    scope === 'total' ? (p.wins ?? 0) : (p.profileWins?.[scope] ?? 0);

  const sorted = [...savedPlayers].sort((a, b) => {
    const wDiff = winsFor(b) - winsFor(a);
    return wDiff !== 0 ? wDiff : a.name.localeCompare(b.name, 'nl');
  });

  const topWins = sorted.length ? winsFor(sorted[0]) : 0;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 16px 8px',
        }}
      >
        <IconBtn theme={t} name="back" onClick={actions.goHome} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 17,
              color: t.text,
            }}
          >
            Spelers
          </span>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Filter per speltype */}
      {gameProfiles.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '6px 18px 10px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {[{ id: 'total', name: 'Totaal' }, ...gameProfiles].map((opt) => {
            const active = scope === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setScope(opt.id)}
                style={{
                  flexShrink: 0,
                  height: 36,
                  padding: '0 16px',
                  border: `1px solid ${active ? t.accent : t.border}`,
                  borderRadius: 18,
                  cursor: 'pointer',
                  background: active ? t.accent : t.surface,
                  color: active ? t.accentText : t.text,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  transition: 'background .15s, border-color .15s',
                }}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: '8px 18px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 30,
                background: t.surface2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.faint,
              }}
            >
              <Icon name="person" size={52} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, color: t.text }}>
              Nog geen spelers
            </div>
            <div style={{ fontSize: 15, color: t.muted, maxWidth: 240, lineHeight: 1.4 }}>
              Spelers worden automatisch opgeslagen zodra je een spel aanmaakt.
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: t.muted,
                padding: '4px 4px 0',
              }}
            >
              {sorted.length} {sorted.length === 1 ? 'speler' : 'spelers'}
            </div>

            {sorted.map((p, i) => {
              const wins = winsFor(p);
              const isLeader = wins > 0 && wins === topWins;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: t.surface,
                    borderRadius: 18,
                    padding: '12px 16px 12px 14px',
                    border: `1px solid ${t.border}`,
                    boxShadow: t.shadow,
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      width: 22,
                      textAlign: 'right',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      color: t.faint,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Avatar */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: p.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {p.name[0].toUpperCase()}
                  </div>

                  {/* Name */}
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
                  </div>

                  {/* Wins badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      flexShrink: 0,
                    }}
                  >
                    {isLeader && (
                      <Icon name="trophy" size={16} style={{ color: '#F4B400' }} />
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 20,
                        color: wins > 0 ? t.text : t.faint,
                      }}
                    >
                      {wins}
                    </span>
                    <span style={{ fontSize: 13, color: t.muted, fontWeight: 500 }}>
                      {wins === 1 ? 'win' : 'wins'}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
