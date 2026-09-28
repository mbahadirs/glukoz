import { useMemo } from 'react';
import { useTheme } from '../../hooks/theme';

export interface ChartPalette {
  text: string;
  muted: string;
  border: string;
  surface: string;
  bg: string;
  band: string;
  veryLow: string;
  low: string;
  inRange: string;
  high: string;
  veryHigh: string;
  accent: string;
}

const FALLBACK: ChartPalette = {
  text: '#111a15',
  muted: '#4b5a52',
  border: '#cfd8d3',
  surface: '#f5f7f6',
  bg: '#ffffff',
  band: 'rgba(21,128,61,0.1)',
  veryLow: '#7f1d1d',
  low: '#c81e1e',
  inRange: '#15803d',
  high: '#a16207',
  veryHigh: '#c2410c',
  accent: '#0f5132',
};

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function readPalette(): ChartPalette {
  return {
    text: cssVar('--text', FALLBACK.text),
    muted: cssVar('--muted', FALLBACK.muted),
    border: cssVar('--border', FALLBACK.border),
    surface: cssVar('--surface', FALLBACK.surface),
    bg: cssVar('--bg', FALLBACK.bg),
    band: cssVar('--target-band', FALLBACK.band),
    veryLow: cssVar('--g-very-low', FALLBACK.veryLow),
    low: cssVar('--g-low', FALLBACK.low),
    inRange: cssVar('--g-in-range', FALLBACK.inRange),
    high: cssVar('--g-high', FALLBACK.high),
    veryHigh: cssVar('--g-very-high', FALLBACK.veryHigh),
    accent: cssVar('--accent', FALLBACK.accent),
  };
}

/** Temaya duyarlı grafik paleti (CSS token'larından). */
export function useChartPalette(): ChartPalette {
  const { resolved } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readPalette(), [resolved]);
}

export function rangeColor(p: ChartPalette, mgdl: number): string {
  if (mgdl < 54) return p.veryLow;
  if (mgdl < 70) return p.low;
  if (mgdl <= 180) return p.inRange;
  if (mgdl <= 250) return p.high;
  return p.veryHigh;
}
