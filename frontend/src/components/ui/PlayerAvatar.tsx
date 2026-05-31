import React from 'react';
import { Player, Theme } from '../../types';

interface PlayerAvatarProps {
  player: Player;
  size?: number;
  ring?: boolean;
  theme: Theme;
}

export default function PlayerAvatar({ player, size = 40, ring = false, theme }: PlayerAvatarProps) {
  const initials = (player.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flexShrink: 0,
        background: player.color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: size * 0.4,
        boxShadow: ring
          ? `0 0 0 3px ${theme.surface}, 0 0 0 6px ${player.color}`
          : 'inset 0 -2px 6px rgba(0,0,0,0.14)',
        letterSpacing: 0.3,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}
