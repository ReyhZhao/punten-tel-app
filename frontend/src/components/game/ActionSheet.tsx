import React from 'react';
import { Theme } from '../../types';
import Icon, { IconName } from '../ui/Icon';

interface ActionItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
}

interface ActionSheetProps {
  theme: Theme;
  open: boolean;
  onClose: () => void;
  actions: ActionItem[];
  title?: string;
}

export default function ActionSheet({ theme, open, onClose, actions: items, title }: ActionSheetProps) {
  const t = theme;
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.35)',
        animation: 'fadeIn .2s ease',
        padding: '0 10px 12px',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ background: t.surface, borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
          {title && (
            <div
              style={{
                padding: '14px 16px 12px',
                textAlign: 'center',
                fontSize: 13,
                color: t.muted,
                borderBottom: `1px solid ${t.sep}`,
              }}
            >
              {title}
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => { onClose(); it.onClick(); }}
              style={{
                width: '100%',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                padding: '17px 16px',
                fontSize: 18,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                color: it.danger ? '#FF453A' : t.accent,
                borderTop: i ? `1px solid ${t.sep}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {it.icon && <Icon name={it.icon} size={19} />}
              {it.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            background: t.surface,
            borderRadius: 18,
            padding: '17px 16px',
            fontSize: 18,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: t.text,
          }}
        >
          Annuleer
        </button>
      </div>
    </div>
  );
}
