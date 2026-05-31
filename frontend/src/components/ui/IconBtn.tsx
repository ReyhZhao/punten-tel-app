import React from 'react';
import { Theme } from '../../types';
import Icon, { IconName } from './Icon';

interface IconBtnProps {
  theme: Theme;
  name: IconName;
  onClick?: () => void;
  size?: number;
  iconSize?: number;
  bg?: string;
  color?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function IconBtn({
  theme, name, onClick, size = 44, iconSize = 22, bg, color, style = {}, disabled,
}: IconBtnProps) {
  const t = theme;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        border: 'none',
        background: bg ?? t.surface2,
        color: color ?? t.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
        transition: 'transform .12s ease',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.9)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Icon name={name} size={iconSize} />
    </button>
  );
}
