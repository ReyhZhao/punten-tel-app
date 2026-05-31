import React from 'react';
import { Theme, Game, Player } from '../../types';
import Btn from '../ui/Btn';
import Icon from '../ui/Icon';
import PlayerAvatar from '../ui/PlayerAvatar';

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface TurnTimerProps {
  theme: Theme;
  game: Game;
  turnPlayer: Player;
  remaining: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
  onNext: () => void;
}

export default function TurnTimer({
  theme, game, turnPlayer, remaining, running, onToggle, onReset, onNext,
}: TurnTimerProps) {
  const t = theme;
  const low = remaining <= 5 && remaining > 0;
  const done = remaining === 0;
  const frac = game.timerSecs ? remaining / game.timerSecs : 0;

  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 18,
        border: `1px solid ${done ? '#FF453A' : t.border}`,
        padding: '12px 14px',
        boxShadow: t.shadow,
        animation: done ? 'shake .4s ease' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <PlayerAvatar player={turnPlayer} size={40} theme={t} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.accent,
            }}
          >
            Aan de beurt
          </div>
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
            {turnPlayer.name}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 30,
            color: done || low ? '#FF453A' : t.text,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 64,
            textAlign: 'right',
          }}
        >
          {fmtTime(remaining)}
        </div>
      </div>

      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: t.surface2,
          margin: '10px 0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${frac * 100}%`,
            background: done || low ? '#FF453A' : t.accent,
            borderRadius: 3,
            transition: 'width .9s linear',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn
          theme={t}
          size="sm"
          variant="soft"
          onClick={onReset}
          style={{ flex: '0 0 auto', paddingLeft: 14, paddingRight: 14 }}
        >
          <Icon name="reset" size={17} />
        </Btn>
        <Btn theme={t} size="sm" variant="soft" onClick={onToggle} style={{ flex: 1 }}>
          <Icon name={running ? 'pause' : 'play'} size={17} />
          {running ? 'Pauze' : 'Start'}
        </Btn>
        <Btn theme={t} size="sm" onClick={onNext} style={{ flex: 1 }}>
          Volgende <Icon name="chevR" size={17} />
        </Btn>
      </div>
    </div>
  );
}
