import React from 'react';
import { Theme, Game, Actions } from '../../types';
import { relTime } from '../../store';
import Card from '../ui/Card';
import Btn from '../ui/Btn';
import Icon from '../ui/Icon';
import IconBtn from '../ui/IconBtn';
import PlayerAvatar from '../ui/PlayerAvatar';

interface Props {
  theme: Theme;
  games: Game[];
  actions: Actions;
}

export default function HomeScreen({ theme, games, actions }: Props) {
  const t = theme;
  const sorted = [...games].sort((a, b) => b.lastPlayed - a.lastPlayed);

  const leaderOf = (g: Game) => {
    if (!g.players.length) return null;
    const arr = [...g.players].sort((a, b) =>
      g.scoring === 'low' ? a.score - b.score : b.score - a.score
    );
    return arr[0];
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* Header */}
      <div
        style={{
          padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 22px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: t.accent,
            }}
          >
            Puntenteller
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 38,
              lineHeight: 1.05,
              color: t.text,
              margin: '2px 0 0',
            }}
          >
            Spellen
          </h1>
        </div>
        <IconBtn theme={t} name="person" onClick={actions.goPlayers} />
      </div>

      {/* Game list */}
      <div
        style={{
          flex: 1,
          padding: '14px 18px 120px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {sorted.length === 0 && (
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
              <Icon name="dice" size={52} />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 21,
                color: t.text,
              }}
            >
              Nog geen spellen
            </div>
            <div style={{ fontSize: 15, color: t.muted, maxWidth: 240, lineHeight: 1.4 }}>
              Maak een nieuw spel aan, voeg je spelers toe en begin met punten tellen.
            </div>
          </div>
        )}

        {sorted.map((g) => {
          const leader = leaderOf(g);
          return (
            <Card
              key={g.id}
              theme={t}
              onClick={() => actions.openGame(g.id)}
              pad={0}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '16px 18px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 20,
                          color: t.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {g.name}
                      </span>
                      {g.finished && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.4,
                            color: t.accent,
                            background: t.surface2,
                            padding: '3px 8px',
                            borderRadius: 8,
                            fontFamily: 'var(--font-display)',
                            flexShrink: 0,
                          }}
                        >
                          KLAAR
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 4,
                        color: t.muted,
                        fontSize: 13.5,
                      }}
                    >
                      <Icon
                        name={g.scoring === 'low' ? 'down' : 'up'}
                        size={15}
                        strokeWidth={2.4}
                        style={{ color: t.accent }}
                      />
                      <span>{g.scoring === 'low' ? 'Laagste wint' : 'Hoogste wint'}</span>
                      <span style={{ color: t.faint }}>·</span>
                      <span>{relTime(g.lastPlayed)}</span>
                    </div>
                  </div>
                  <Icon name="chevR" size={20} style={{ color: t.faint, marginTop: 4 }} />
                </div>
              </div>

              {/* Player strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: t.surface2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {g.players.slice(0, 6).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                      <PlayerAvatar
                        player={p}
                        size={30}
                        theme={{ ...t, surface: t.surface2 }}
                        ring
                      />
                    </div>
                  ))}
                  {g.players.length > 6 && (
                    <span style={{ marginLeft: 6, fontSize: 13, color: t.muted, fontWeight: 600 }}>
                      +{g.players.length - 6}
                    </span>
                  )}
                </div>
                {leader && g.log.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.text }}>
                    <Icon name="trophy" size={16} style={{ color: '#F4B400' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{leader.name}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 16,
                        color: t.accent,
                      }}
                    >
                      {leader.score}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13.5, color: t.muted }}>{g.players.length} spelers</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Fixed bottom bar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 'max(18px, env(safe-area-inset-bottom)) 18px max(38px, calc(env(safe-area-inset-bottom) + 18px))',
          background: `linear-gradient(to top, ${t.bg} 62%, transparent)`,
        }}
      >
        <Btn theme={t} full size="lg" onClick={actions.startNewGame}>
          <Icon name="plus" size={22} /> Nieuw spel
        </Btn>
      </div>
    </div>
  );
}
