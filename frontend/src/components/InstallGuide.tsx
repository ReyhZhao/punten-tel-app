import React, { useState } from 'react';
import { Theme } from '../types';
import { Platform, detectPlatform, useInstall } from '../pwa';
import Icon from './ui/Icon';
import IconBtn from './ui/IconBtn';
import Btn from './ui/Btn';

interface Props {
  theme: Theme;
  onClose: () => void;
}

interface Guide {
  key: Platform;
  tab: string;
  note: React.ReactNode;
  steps: React.ReactNode[];
}

const GUIDES: Guide[] = [
  {
    key: 'ios',
    tab: 'iPhone / iPad',
    note: 'Open deze pagina in Safari.',
    steps: [
      <>Tik onderaan op de <strong>Deel</strong>-knop <Icon name="share" size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />.</>,
      <>Scroll naar beneden en kies <strong>Zet op beginscherm</strong>.</>,
      <>Tik rechtsboven op <strong>Voeg toe</strong>.</>,
    ],
  },
  {
    key: 'android',
    tab: 'Android',
    note: 'Gebruik Google Chrome.',
    steps: [
      <>Tik rechtsboven op het <strong>menu</strong> (drie puntjes).</>,
      <>Kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.</>,
      <>Bevestig met <strong>Installeren</strong>.</>,
    ],
  },
  {
    key: 'desktop',
    tab: 'Computer',
    note: 'Gebruik Chrome of Edge.',
    steps: [
      <>Klik in de adresbalk rechts op het <strong>installatie-icoon</strong>.</>,
      <>Of open het <strong>menu</strong> (drie puntjes) → <strong>Puntenteller installeren</strong>.</>,
      <>Klik op <strong>Installeren</strong>.</>,
    ],
  },
];

export default function InstallGuide({ theme, onClose }: Props) {
  const t = theme;
  const { canInstall, promptInstall } = useInstall();
  const [platform, setPlatform] = useState<Platform>(detectPlatform);

  const guide = GUIDES.find((g) => g.key === platform) ?? GUIDES[0];

  const handleNativeInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: t.bg,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn .2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 16px 6px',
        }}
      >
        <IconBtn theme={t} name="x" onClick={onClose} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: t.text }}>
          App installeren
        </span>
        <div style={{ width: 44 }} />
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 20px max(28px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {/* Intro */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingTop: 8 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 26,
              background: t.surface2,
              color: t.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="download" size={42} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: t.text, margin: 0 }}>
            Puntenteller als app
          </h1>
          <p style={{ fontSize: 15, color: t.muted, margin: 0, maxWidth: 320, lineHeight: 1.45 }}>
            Installeer Puntenteller op je toestel voor een eigen icoon op het beginscherm,
            een schermvullende weergave en offline gebruik.
          </p>
        </div>

        {/* Native install (waar ondersteund) */}
        {canInstall && (
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              boxShadow: t.shadow,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, color: t.muted, textAlign: 'center' }}>
              Jouw browser ondersteunt installeren met één tik:
            </div>
            <Btn theme={t} full onClick={handleNativeInstall}>
              <Icon name="download" size={20} /> Installeer nu
            </Btn>
          </div>
        )}

        {/* OS-keuze */}
        <div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.muted,
              margin: '0 0 8px 4px',
            }}
          >
            {canInstall ? 'Of handmatig' : 'Kies je toestel'}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 5, background: t.surface2, borderRadius: 15 }}>
            {GUIDES.map((g) => {
              const active = g.key === platform;
              return (
                <button
                  key={g.key}
                  onClick={() => setPlatform(g.key)}
                  style={{
                    flex: 1,
                    height: 44,
                    border: 'none',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: active ? t.surface : 'transparent',
                    color: active ? t.text : t.muted,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {g.tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stappen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13.5,
              color: t.muted,
              paddingLeft: 4,
            }}
          >
            <Icon name="spark" size={15} style={{ color: t.accent }} />
            {guide.note}
          </div>
          {guide.steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: t.accent,
                  color: t.accentText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 15.5, color: t.text, lineHeight: 1.45, paddingTop: 2 }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
