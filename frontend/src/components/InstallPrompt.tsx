import React from 'react';
import { Theme } from '../types';
import Icon from './ui/Icon';
import Btn from './ui/Btn';

interface Props {
  theme: Theme;
  onMoreInfo: () => void;
  onClose: () => void;
}

/** Compacte eenmalige melding dat de app als PWA geïnstalleerd kan worden. */
export default function InstallPrompt({ theme, onMoreInfo, onClose }: Props) {
  const t = theme;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.35)',
        animation: 'fadeIn .2s ease',
        padding: '0 12px max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          borderRadius: 22,
          padding: '18px 18px 16px',
          boxShadow: t.shadow,
          animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: t.surface2,
              color: t.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="download" size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 17,
                color: t.text,
              }}
            >
              Installeer Puntenteller
            </div>
            <div style={{ fontSize: 13.5, color: t.muted, marginTop: 2, lineHeight: 1.35 }}>
              Voeg de app toe aan je beginscherm voor snelle toegang en offline gebruik.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 50,
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              background: t.surface2,
              color: t.text,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Niet nu
          </button>
          <div style={{ flex: 1.4 }}>
            <Btn theme={t} full size="md" onClick={onMoreInfo} style={{ height: 50 }}>
              <Icon name="chevR" size={18} /> Meer info
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
