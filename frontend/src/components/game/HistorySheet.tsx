import React from 'react';
import { Theme, Game } from '../../types';
import { relTime } from '../../store';
import PlayerAvatar from '../ui/PlayerAvatar';
import IconBtn from '../ui/IconBtn';
import Icon from '../ui/Icon';

interface HistorySheetProps {
  theme: Theme;
  open: boolean;
  onClose: () => void;
  game: Game;
  onUndo: (logId: string) => void;
}

export default function HistorySheet({ theme, open, onClose, game, onUndo }: HistorySheetProps) {
  const t = theme;
  if (!open) return null;
  const byId = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const entries = [...game.log].reverse();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.35)',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.bg,
          borderRadius: '26px 26px 0 0',
          maxHeight: '80%',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)',
          paddingBottom: 30,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '14px 16px 10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 38,
              height: 5,
              borderRadius: 3,
              background: t.faint,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: t.text,
              marginTop: 6,
            }}
          >
            Historie
          </span>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: 14,
              top: 16,
              border: 'none',
              background: t.surface2,
              width: 32,
              height: 32,
              borderRadius: 16,
              color: t.muted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ overflow: 'auto', padding: '6px 16px 0' }}>
          {entries.length === 0 ? (
            <div
              style={{ textAlign: 'center', color: t.muted, padding: '40px 20px', fontSize: 15 }}
            >
              <Icon name="list" size={40} style={{ color: t.faint, margin: '0 auto 12px' }} />
              Nog geen punten geboekt.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {entries.map((e) => {
                const p = byId[e.playerId];
                if (!p) return null;
                const pos = e.delta >= 0;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: t.surface,
                      borderRadius: 15,
                      padding: '10px 10px 10px 12px',
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    <PlayerAvatar player={p} size={36} theme={t} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15.5,
                          fontWeight: 600,
                          color: t.text,
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: t.muted }}>{relTime(e.ts)}</div>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 19,
                        color: pos ? '#34C759' : '#FF453A',
                      }}
                    >
                      {pos ? '+' : ''}{e.delta}
                    </span>
                    <IconBtn
                      theme={t}
                      name="undo"
                      size={36}
                      iconSize={18}
                      bg="transparent"
                      color={t.muted}
                      onClick={() => onUndo(e.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
