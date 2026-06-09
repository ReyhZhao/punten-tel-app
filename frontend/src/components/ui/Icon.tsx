import React from 'react';

export type IconName =
  | 'plus' | 'minus' | 'back' | 'chevR' | 'chevD' | 'x' | 'check'
  | 'trophy' | 'clock' | 'undo' | 'trash' | 'ellipsis' | 'dice' | 'flag'
  | 'play' | 'pause' | 'reset' | 'up' | 'down' | 'person' | 'grip' | 'spark' | 'list'
  | 'gear' | 'sun';

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 24, strokeWidth = 2.2, style = {} }: IconProps) {
  const p = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<IconName, React.ReactNode> = {
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
    gear: <><circle cx="12" cy="12" r="3.2" {...p} /><path d="M12 2.5l1.4 2.3 2.6-.6.3 2.7 2.4 1.2-1.2 2.4 1.2 2.4-2.4 1.2-.3 2.7-2.6-.6L12 21.5l-1.4-2.3-2.6.6-.3-2.7-2.4-1.2 1.2-2.4-1.2-2.4 2.4-1.2.3-2.7 2.6.6z" {...p} /></>,
    sun: <><circle cx="12" cy="12" r="4" {...p} /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" {...p} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', ...style }}>
      {paths[name]}
    </svg>
  );
}
