import React from 'react';
import { Theme } from '../../types';

interface CardProps {
  theme: Theme;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  pad?: number;
}

export default function Card({ theme, children, onClick, style = {}, pad = 16 }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme.surface,
        borderRadius: 22,
        padding: pad,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
