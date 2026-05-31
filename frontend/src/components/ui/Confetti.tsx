import React, { useMemo } from 'react';
import { PLAYER_COLORS } from '../../theme';

interface Piece {
  id: number;
  left: number;
  color: string;
  delay: number;
  dur: number;
  size: number;
  rot: number;
  round: boolean;
  drift: number;
}

export default function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        delay: Math.random() * 2.5,
        dur: 2.4 + Math.random() * 2.2,
        size: 7 + Math.random() * 8,
        rot: Math.random() * 360,
        round: Math.random() > 0.5,
        drift: (Math.random() - 0.5) * 80,
      })),
    [count],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {pieces.map((p) => (
        <div
          key={p.id}
          style={
            {
              position: 'absolute',
              top: -20,
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              '--drift': `${p.drift}px`,
              animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
              transform: `rotate(${p.rot}deg)`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
