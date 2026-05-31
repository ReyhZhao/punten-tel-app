import { Theme } from './types';

export const PLAYER_COLORS = [
  '#FF5A5F',
  '#FF8A3D',
  '#F4B400',
  '#34C759',
  '#00C2C7',
  '#4D8DFF',
  '#8B6CFF',
  '#FF6FB5',
] as const;

export const theme: Theme = {
  dark: false,
  bg: '#FAF6EE',
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
};
