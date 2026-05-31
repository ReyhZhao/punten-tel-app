import React from 'react';
import { Theme, Game, Actions } from '../../types';
import Confetti from '../ui/Confetti';
import PlayerAvatar from '../ui/PlayerAvatar';
import Icon from '../ui/Icon';
import IconBtn from '../ui/IconBtn';
import Btn from '../ui/Btn';

interface Props {
  theme: Theme;
  game: Game;
  actions: Actions;
}

export default function WinnerScreen({ theme, game, actions }: Props) {
  const t = theme;
  const ranked = [...game.players].sort((a, b) =>
    game.scoring === 'low' ? a.score - b.score : b.score - a.score
  );
  const winner = ranked[0];
  const podium = ranked.slice(0, 3);
  const podiumOrder = [1, 0, 2]; // visual: silver, gold, bronze
  const heights: Record<number, number> = { 0: 120, 1: 88, 2: 68 };
  const medals: Record<number, string> = { 0: '#F4B400', 1: '#C7CBD1', 2: '#CD7F4D' };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: `linear-gradient(180deg, ${t.surface2} 0%, ${t.bg} 40%)`,
      }}
    >
      <Confetti />

      {/* Close button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 16px 0',
          position: 'relative',
          zIndex: 31,
        }}
      >
        <IconBtn theme={t} name="x" onClick={actions.goHome} />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 20px 20px',
          position: 'relative',
          zIndex: 31,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: t.accent,
          }}
        >
          Winnaar
        </div>

        <div style={{ marginTop: 14 }}>
          <PlayerAvatar player={winner} size={92} theme={t} />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 32,
            color: t.text,
            margin: '12px 0 0',
            textAlign: 'center',
          }}
        >
          {winner.name}
        </h1>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 44,
              color: t.accent,
              lineHeight: 1,
            }}
          >
            {winner.score}
          </span>
          <span style={{ fontSize: 15, color: t.muted, fontWeight: 600 }}>punten</span>
        </div>

        {/* Podium */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 10,
            marginTop: 26,
            width: '100%',
            maxWidth: 320,
          }}
        >
          {podiumOrder.map((rankIdx) => {
            const p = podium[rankIdx];
            if (!p) return <div key={rankIdx} style={{ flex: 1 }} />;
            return (
              <div
                key={p.id}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <PlayerAvatar player={p} size={rankIdx === 0 ? 48 : 40} theme={t} />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.text,
                    fontFamily: 'var(--font-display)',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: heights[rankIdx],
                    borderRadius: '14px 14px 0 0',
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderBottom: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: 12,
                    gap: 4,
                    boxShadow: t.shadow,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: medals[rankIdx],
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {rankIdx + 1}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 18,
                      color: t.text,
                    }}
                  >
                    {p.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full ranking for 4th place and beyond */}
        {ranked.length > 3 && (
          <div
            style={{
              width: '100%',
              marginTop: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {ranked.slice(3).map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 14px',
                  background: t.surface,
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                }}
              >
                <span
                  style={{
                    width: 22,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    color: t.muted,
                    fontSize: 15,
                  }}
                >
                  {i + 4}
                </span>
                <PlayerAvatar player={p} size={30} theme={t} />
                <span style={{ flex: 1, fontSize: 15.5, color: t.text, fontWeight: 500 }}>
                  {p.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 17,
                    color: t.text,
                  }}
                >
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div
        style={{
          padding:
            '12px 18px max(34px, calc(env(safe-area-inset-bottom) + 12px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
          zIndex: 31,
        }}
      >
        <Btn theme={t} full size="lg" onClick={() => actions.rematch(game.id)}>
          <Icon name="reset" size={20} /> Opnieuw spelen
        </Btn>
        <Btn theme={t} full size="md" variant="soft" onClick={actions.goHome}>
          Terug naar spellen
        </Btn>
      </div>
    </div>
  );
}
