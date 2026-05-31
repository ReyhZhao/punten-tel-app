import React from 'react';
import { Theme } from '../../types';

interface BtnProps {
  theme: Theme;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  style?: React.CSSProperties;
  full?: boolean;
}

export default function Btn({
  theme, children, onClick, variant = 'primary', size = 'lg', disabled, style = {}, full,
}: BtnProps) {
  const t = theme;
  const sizes = {
    lg: { padding: '0 22px', height: 54, fontSize: 18, radius: 16 },
    md: { padding: '0 18px', height: 46, fontSize: 16, radius: 14 },
    sm: { padding: '0 14px', height: 38, fontSize: 15, radius: 12 },
  }[size];
  const variants = {
    primary: { background: t.accent, color: t.accentText, boxShadow: t.shadow },
    soft:    { background: t.surface2, color: t.text },
    ghost:   { background: 'transparent', color: t.accent },
    danger:  { background: 'transparent', color: '#FF453A' },
  }[variant];

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        letterSpacing: 0.2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        width: full ? '100%' : undefined,
        height: sizes.height,
        padding: sizes.padding,
        borderRadius: sizes.radius,
        fontSize: sizes.fontSize,
        opacity: disabled ? 0.4 : 1,
        transition: 'transform .12s ease, opacity .15s',
        WebkitTapHighlightColor: 'transparent',
        ...variants,
        ...style,
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.96)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}
