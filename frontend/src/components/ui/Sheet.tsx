import React from 'react';
import { Theme } from '../../types';
import Icon from './Icon';

interface SheetProps {
  theme: Theme;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom sheet met titel en sluitknop (zelfde stijl als HistorySheet). */
export default function Sheet({ theme: t, title, onClose, children }: SheetProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
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
          maxHeight: '88%',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)',
          paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 18px 8px' }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: t.text }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            style={{
              width: 36, height: 36, borderRadius: 18, border: 'none', cursor: 'pointer',
              background: t.surface2, color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ overflow: 'auto', padding: '6px 18px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Tekstveld in kaartstijl. */
export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { theme: Theme }) {
  const { theme: t, style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        height: 52, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface,
        padding: '0 16px', fontSize: 17, color: t.text, outline: 'none', width: '100%', boxSizing: 'border-box',
        ...style,
      }}
    />
  );
}

export function Hint({ theme: t, children, error }: { theme: Theme; children: React.ReactNode; error?: boolean }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.4, color: error ? '#FF453A' : t.muted, padding: '0 4px' }}>{children}</div>
  );
}
