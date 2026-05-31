// theme.jsx — design tokens, player palette, icons & shared primitives
// Exports to window: THEMES, PLAYER_COLORS, makeTheme, Icon, Btn, IconBtn,
//                    Card, uid, relTime, useTick

// ── Player pawn colors (consistent across themes) ──────────────
const PLAYER_COLORS = [
  '#FF5A5F', // coral
  '#FF8A3D', // orange
  '#F4B400', // amber
  '#34C759', // green
  '#00C2C7', // teal
  '#4D8DFF', // blue
  '#8B6CFF', // violet
  '#FF6FB5', // pink
];

// ── Themes (all playful / game-night) ──────────────────────────
const THEMES = {
  confetti: {
    name: 'Confetti',
    dark: false,
    bg: '#FAF6EE',
    stage: '#ECE6DA',
    surface: '#FFFFFF',
    surface2: '#F3ECDF',
    text: '#28231D',
    muted: '#9C9384',
    faint: '#C9C0B0',
    accent: '#FF5A3C',
    accentText: '#FFFFFF',
    border: 'rgba(40,35,29,0.08)',
    sep: 'rgba(40,35,29,0.07)',
    shadow: '0 1px 2px rgba(40,35,29,0.05), 0 8px 24px rgba(40,35,29,0.07)',
    glow: 'none',
  },
  arcade: {
    name: 'Arcade',
    dark: true,
    bg: '#100C1E',
    stage: '#070510',
    surface: '#1B1533',
    surface2: '#251D45',
    text: '#F5F2FF',
    muted: '#9A93B8',
    faint: '#5B5480',
    accent: '#FF3DAE',
    accentText: '#160B26',
    border: 'rgba(255,255,255,0.09)',
    sep: 'rgba(255,255,255,0.08)',
    shadow: '0 2px 8px rgba(0,0,0,0.4), 0 12px 36px rgba(0,0,0,0.5)',
    glow: '0 0 18px rgba(255,61,174,0.45)',
  },
  pastel: {
    name: 'Pastel',
    dark: false,
    bg: '#F4F1FF',
    stage: '#E6E1F7',
    surface: '#FFFFFF',
    surface2: '#EEE9FC',
    text: '#3A3550',
    muted: '#9A93B5',
    faint: '#CFC9E6',
    accent: '#7C6CFF',
    accentText: '#FFFFFF',
    border: 'rgba(58,53,80,0.08)',
    sep: 'rgba(58,53,80,0.07)',
    shadow: '0 1px 2px rgba(58,53,80,0.05), 0 10px 28px rgba(124,108,255,0.12)',
    glow: 'none',
  },
};

function makeTheme(key, accentOverride) {
  const base = THEMES[key] || THEMES.confetti;
  if (!accentOverride) return base;
  return { ...base, accent: accentOverride };
}

// ── Helpers ────────────────────────────────────────────────────
let _seq = 0;
const uid = () => Date.now().toString(36) + (_seq++).toString(36) + Math.random().toString(36).slice(2, 6);

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'zojuist';
  if (s < 90) return '1 min geleden';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gisteren';
  if (d < 7) return `${d} dagen geleden`;
  return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// re-render hook for timers
function useTick(active, ms = 250) {
  const [, set] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

// ── Icons (stroke uses currentColor) ───────────────────────────
function Icon({ name, size = 24, strokeWidth = 2.2, style = {} }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    plus: <><line x1="12" y1="5" x2="12" y2="19" {...p} /><line x1="5" y1="12" x2="19" y2="12" {...p} /></>,
    minus: <line x1="5" y1="12" x2="19" y2="12" {...p} />,
    back: <path d="M15 5l-7 7 7 7" {...p} />,
    chevR: <path d="M9 5l7 7-7 7" {...p} />,
    chevD: <path d="M5 9l7 7 7-7" {...p} />,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    check: <path d="M4 12.5l5 5L20 6.5" {...p} />,
    trophy: <><path d="M7 4h10v5a5 5 0 01-10 0V4z" {...p} /><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" {...p} /><path d="M12 14v3M9 21h6M10 21l.5-4h3l.5 4" {...p} /></>,
    clock: <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 7.5V12l3 2" {...p} /></>,
    undo: <><path d="M4 9h9a5.5 5.5 0 110 11H8" {...p} /><path d="M7.5 5.5L4 9l3.5 3.5" {...p} /></>,
    trash: <><path d="M5 7h14M9 7V5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5v2M6.5 7l.8 12a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4L17.5 7" {...p} /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
    dice: <><rect x="4" y="4" width="16" height="16" rx="4" {...p} /><circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" /></>,
    flag: <><path d="M6 21V4M6 5h11l-2 3 2 3H6" {...p} /></>,
    play: <path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none" />,
    pause: <><rect x="7" y="6" width="3.4" height="12" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.6" y="6" width="3.4" height="12" rx="1.2" fill="currentColor" stroke="none" /></>,
    reset: <><path d="M19 12a7 7 0 11-2.2-5.1" {...p} /><path d="M19 4v4h-4" {...p} /></>,
    up: <path d="M12 19V5M6 11l6-6 6 6" {...p} />,
    down: <path d="M12 5v14M6 13l6 6 6-6" {...p} />,
    person: <><circle cx="12" cy="8" r="3.6" {...p} /><path d="M5 20a7 7 0 0114 0" {...p} /></>,
    grip: <><circle cx="9" cy="7" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1.3" fill="currentColor" stroke="none" /></>,
    spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" fill="currentColor" stroke="none" />,
    list: <><path d="M8 7h11M8 12h11M8 17h11" {...p} /><circle cx="4.5" cy="7" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="17" r="1.2" fill="currentColor" stroke="none" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', ...style }}>
      {paths[name]}
    </svg>
  );
}

// ── Primitives ─────────────────────────────────────────────────
function Btn({ theme, children, onClick, variant = 'primary', size = 'lg', disabled, style = {}, full }) {
  const t = theme;
  const sizes = {
    lg: { padding: '0 22px', height: 54, fontSize: 18, radius: 16 },
    md: { padding: '0 18px', height: 46, fontSize: 16, radius: 14 },
    sm: { padding: '0 14px', height: 38, fontSize: 15, radius: 12 },
  }[size];
  const variants = {
    primary: { background: t.accent, color: t.accentText, boxShadow: t.dark ? t.glow : t.shadow },
    soft: { background: t.surface2, color: t.text },
    ghost: { background: 'transparent', color: t.accent },
    danger: { background: 'transparent', color: '#FF453A' },
  }[variant];
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 0.2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap', whiteSpace: 'nowrap',
        width: full ? '100%' : undefined,
        height: sizes.height, padding: sizes.padding, borderRadius: sizes.radius, fontSize: sizes.fontSize,
        opacity: disabled ? 0.4 : 1, transition: 'transform .12s ease, opacity .15s',
        WebkitTapHighlightColor: 'transparent', ...variants, ...style,
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.96)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}

function IconBtn({ theme, name, onClick, size = 44, iconSize = 22, bg, color, style = {}, disabled }) {
  const t = theme;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: size, height: size, borderRadius: size / 2, border: 'none',
        background: bg || t.surface2, color: color || t.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        opacity: disabled ? 0.35 : 1, transition: 'transform .12s ease',
        WebkitTapHighlightColor: 'transparent', ...style,
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.9)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Icon name={name} size={iconSize} />
    </button>
  );
}

function Card({ theme, children, onClick, style = {}, pad = 16 }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme.surface, borderRadius: 22, padding: pad,
        boxShadow: theme.shadow, border: `1px solid ${theme.border}`,
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}
    >
      {children}
    </div>
  );
}

Object.assign(window, { THEMES, PLAYER_COLORS, makeTheme, Icon, Btn, IconBtn, Card, uid, relTime, useTick });
