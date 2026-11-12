import React, { useState } from 'react';
import { Theme, Actions, SavedPlayer, GameProfile, Game } from '../../types';
import { gameHistory, rankedPlayers } from '../../store';
import IconBtn from '../ui/IconBtn';
import Icon from '../ui/Icon';

interface Props {
  theme: Theme;
  actions: Actions;
  savedPlayers: SavedPlayer[];
  gameProfiles: GameProfile[];
  games: Game[];
  me?: SavedPlayer;
}

// 'total' = alle spellen samen, anders een profiel-id.
type Scope = 'total' | string;
type Mode = 'wins' | 'history';

const dateLabel = (ts: number) =>
  new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PlayersScreen({ theme, actions, savedPlayers, gameProfiles, games, me }: Props) {
  const t = theme;
  const [scope, setScope] = useState<Scope>('total');
  const [mode, setMode] = useState<Mode>('wins');
  // Opengeklapte spellen in de historie.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const history = gameHistory(games, scope === 'total' ? null : scope);

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

      {/* Wins of historie */}
      <div style={{ padding: '4px 18px 6px' }}>
        <div
          role="tablist"
          style={{ display: 'flex', background: t.surface2, borderRadius: 12, padding: 3, gap: 3 }}
        >
          {([['wins', 'Wins'], ['history', 'Historie']] as const).map(([id, label]) => {
            const active = mode === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(id)}
                style={{
                  flex: 1,
                  height: 34,
                  border: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  background: active ? t.surface : 'transparent',
                  boxShadow: active ? t.shadow : 'none',
                  color: active ? t.text : t.muted,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
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
        {mode === 'history' ? (
          history.length === 0 ? (
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 14, padding: '60px 20px', textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 96, height: 96, borderRadius: 30, background: t.surface2, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: t.faint,
                }}
              >
                <Icon name="clock" size={52} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, color: t.text }}>
                Nog geen afgeronde spellen
              </div>
              <div style={{ fontSize: 15, color: t.muted, maxWidth: 260, lineHeight: 1.4 }}>
                Zodra een spel afgelopen is, zie je hier wie won en hoeveel punten iedereen had.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                  color: t.muted, padding: '4px 4px 0',
                }}
              >
                {history.length} {history.length === 1 ? 'spel' : 'spellen'}
              </div>
              {history.map((g) => {
                const ranked = rankedPlayers(g);
                const winner = ranked[0];
                const isOpen = open.has(g.id);
                return (
                  <div
                    key={g.id}
                    style={{
                      background: t.surface, borderRadius: 18, border: `1px solid ${t.border}`,
                      boxShadow: t.shadow, overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => toggle(g.id)}
                      aria-expanded={isOpen}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 12px 16px',
                        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: t.text,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: t.text,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
                          {g.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: t.muted }}>{dateLabel(g.lastPlayed)}</div>
                      </div>
                      {winner && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
                          <Icon name="trophy" size={15} style={{ color: '#F4B400', flexShrink: 0 }} />
                          <span
                            style={{
                              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: t.text,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110,
                            }}
                          >
                            {winner.name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: t.accent,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {winner.score}
                          </span>
                        </div>
                      )}
                      <Icon
                        name="chevD"
                        size={16}
                        style={{
                          color: t.muted, flexShrink: 0, transition: 'transform .15s',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px 12px' }}>
                        {ranked.map((p, i) => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 18, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 700,
                                fontSize: 13, color: t.faint, flexShrink: 0,
                              }}
                            >
                              {i + 1}
                            </div>
                            <div
                              style={{
                                width: 26, height: 26, borderRadius: '50%', background: p.color, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                                color: '#fff', flexShrink: 0,
                              }}
                            >
                              {p.name[0]?.toUpperCase()}
                            </div>
                            <div
                              style={{
                                flex: 1, minWidth: 0, fontSize: 15, color: t.text,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}
                            >
                              {p.name}
                            </div>
                            <div
                              style={{
                                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                                fontVariantNumeric: 'tabular-nums', color: i === 0 ? t.accent : t.text,
                              }}
                            >
                              {p.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )
        ) : sorted.length === 0 ? (
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
            {/* Wie ben jij? Die speler staat daarna meteen in elk nieuw spel. */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted, padding: '4px 4px 0' }}>
                Wie ben jij?
              </span>
              <select
                value={me?.id ?? ''}
                onChange={(e) => actions.setMyPlayer(e.target.value || null)}
                style={{
                  height: 48, borderRadius: 14, border: `1px solid ${t.border}`, background: t.surface, color: t.text,
                  padding: '0 12px', fontSize: 16, width: '100%',
                }}
              >
                <option value="">Niet ingesteld</option>
                {[...savedPlayers].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: t.muted, padding: '0 4px', lineHeight: 1.4 }}>
                Deze speler staat automatisch in elk nieuw spel.
              </span>
            </label>
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
                    {me?.id === p.id && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.muted }}>Jij</div>
                    )}
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
