import React from 'react';
import { Theme } from '../types';
import { isStandalone } from '../pwa';
import Icon from './ui/Icon';

interface Props {
  theme: Theme;
  open: boolean;
  onClose: () => void;
  keepAwake: boolean;
  onKeepAwakeChange: (on: boolean) => void;
  onInstall: () => void;
}

const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

export default function SettingsSheet({ theme, open, onClose, keepAwake, onKeepAwakeChange, onInstall }: Props) {
  const t = theme;
  if (!open) return null;

  const on = keepAwake && wakeLockSupported;

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}
      >
        <div style={{ background: t.surface, borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              padding: '16px 18px 12px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 17,
              color: t.text,
              borderBottom: `1px solid ${t.sep}`,
            }}
          >
            Instellingen
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              opacity: wakeLockSupported ? 1 : 0.5,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: t.surface2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.accent,
                flexShrink: 0,
              }}
            >
              <Icon name="sun" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: t.text,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Scherm aan houden
              </div>
              <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2, lineHeight: 1.35 }}>
                {wakeLockSupported
                  ? 'Voorkomt dat het scherm tijdens het spelen uitgaat'
                  : 'Niet ondersteund door deze browser'}
              </div>
            </div>
            <button
              onClick={() => wakeLockSupported && onKeepAwakeChange(!keepAwake)}
              disabled={!wakeLockSupported}
              style={{
                border: 'none',
                cursor: wakeLockSupported ? 'pointer' : 'default',
                width: 52,
                height: 31,
                borderRadius: 16,
                padding: 2,
                background: on ? '#34C759' : t.faint,
                transition: 'background .2s',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: on ? 'translateX(21px)' : 'translateX(0)',
                  transition: 'transform .2s',
                }}
              />
            </button>
          </div>

          {!isStandalone() && (
            <button
              onClick={onInstall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '16px 18px',
                border: 'none',
                borderTop: `1px solid ${t.sep}`,
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: t.surface2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: t.accent,
                  flexShrink: 0,
                }}
              >
                <Icon name="download" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: t.text,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  App installeren
                </div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
                  Zet Puntenteller op je beginscherm
                </div>
              </div>
              <Icon name="chevR" size={20} style={{ color: t.faint, flexShrink: 0 }} />
            </button>
          )}
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
          Klaar
        </button>
      </div>
    </div>
  );
}
