import type { GlucosePoint } from '@glukoz/shared';
import { round } from './stats.js';

/**
 * Canlı grafik için eğilim ve kısa vadeli doğrusal öngörü.
 * Yalnızca matematiksel uzatmadır: öğün, insülin, egzersiz etkilerini içermez.
 */

const MIN = 60_000;
const CLAMP_LOW = 40;
const CLAMP_HIGH = 400;
/** İki yönlü %95 Student-t kritik değerleri (serbestlik derecesi → t). */
const T_975: ReadonlyArray<[number, number]> = [
  [1, 12.71],
  [2, 4.3],
  [3, 3.18],
  [4, 2.78],
  [5, 2.57],
  [6, 2.45],
  [8, 2.31],
  [10, 2.23],
  [15, 2.13],
  [20, 2.09],
  [30, 2.04],
];

export function tCritical(df: number): number {
  for (const [d, t] of T_975) if (df <= d) return t;
  return 1.96;
}

/**
 * Aralığın alt sınırı (mg/dL, yarı genişlik): regresyon kalıntısı çok küçük olsa bile
 * CGM ölçüm hatası ve fizyolojik değişkenlik nedeniyle belirsizlik ufukla büyür.
 */
export function minHalfWidth(minutesAhead: number): number {
  return 4 + 0.35 * minutesAhead;
}

export interface TrendSegment {
  from: GlucosePoint;
  to: GlucosePoint;
  deltaMgdl: number;
  minutes: number;
  /** mg/dL/dk */
  ratePerMin: number;
}

/** İki nokta arasındaki değişim ve eğim (sıra fark etmez; zamana göre sıralanır). */
export function segmentTrend(a: GlucosePoint, b: GlucosePoint): TrendSegment | null {
  const [from, to] = a.ts <= b.ts ? [a, b] : [b, a];
  const minutes = (to.ts - from.ts) / MIN;
  if (minutes <= 0) return null;
  const deltaMgdl = to.mgdl - from.mgdl;
  return {
    from,
    to,
    deltaMgdl,
    minutes: round(minutes, 1) as number,
    ratePerMin: round(deltaMgdl / minutes, 2) as number,
  };
}

/** Bir eğimi `from` noktasından ileri uzatır (değerler 40–400 arasına sıkıştırılır). */
export function extrapolate(
  from: GlucosePoint,
  ratePerMin: number,
  horizonMin: number,
  stepMin = 5,
): GlucosePoint[] {
  const out: GlucosePoint[] = [];
  for (let m = stepMin; m <= horizonMin; m += stepMin) {
    out.push({ ts: from.ts + m * MIN, mgdl: clamp(from.mgdl + ratePerMin * m) });
  }
  return out;
}

export interface ProjectedPoint extends GlucosePoint {
  lo: number;
  hi: number;
}

export interface Projection {
  /** mg/dL/dk */
  slope: number;
  r2: number | null;
  residualSd: number;
  basedOn: { from: number; to: number; count: number };
  /** son ölçüm (öngörünün başladığı nokta) */
  anchor: GlucosePoint;
  points: ProjectedPoint[];
}

export interface ProjectionOptions {
  now?: number;
  /** regresyona giren geçmiş pencere (dk) */
  lookbackMin?: number;
  horizonMin?: number;
  stepMin?: number;
  /** son ölçüm bundan eskiyse öngörü yapılmaz (dk) */
  maxAgeMin?: number;
  minPoints?: number;
  /** penceredeki verinin kapsaması gereken en kısa süre (dk) */
  minSpanMin?: number;
}

function clamp(v: number): number {
  return Math.min(CLAMP_HIGH, Math.max(CLAMP_LOW, v));
}

/**
 * Son `lookbackMin` dakikadaki ölçümlere en küçük kareler doğrusu uydurur ve
 * `horizonMin` dakika ileri uzatır; her nokta için ~%95 öngörü aralığı verir.
 * Yeterli, taze veri yoksa null döner.
 */
export function linearProjection(
  points: readonly GlucosePoint[],
  options: ProjectionOptions = {},
): Projection | null {
  const o = {
    lookbackMin: 20,
    horizonMin: 30,
    stepMin: 5,
    maxAgeMin: 10,
    minPoints: 3,
    minSpanMin: 10,
    ...options,
  };
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const last = sorted[sorted.length - 1] as GlucosePoint;
  const now = o.now ?? last.ts;
  if (now - last.ts > o.maxAgeMin * MIN) return null;

  const win = sorted.filter((p) => p.ts >= last.ts - o.lookbackMin * MIN);
  const n = win.length;
  const first = win[0] as GlucosePoint;
  if (n < o.minPoints || last.ts - first.ts < o.minSpanMin * MIN) return null;

  // x: son ölçüme göre dakika (≤ 0)
  const xs = win.map((p) => (p.ts - last.ts) / MIN);
  const ys = win.map((p) => p.mgdl);
  const xm = xs.reduce((a, b) => a + b, 0) / n;
  const ym = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - xm;
    const dy = (ys[i] as number) - ym;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const intercept = ym - slope * xm;
  let sse = 0;
  for (let i = 0; i < n; i++)
    sse += ((ys[i] as number) - (intercept + slope * (xs[i] as number))) ** 2;
  const s = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;

  const out: ProjectedPoint[] = [];
  for (let m = o.stepMin; m <= o.horizonMin; m += o.stepMin) {
    const yhat = intercept + slope * m;
    const se = s * Math.sqrt(1 + 1 / n + (m - xm) ** 2 / sxx);
    const half = Math.max(tCritical(n - 2) * se, minHalfWidth(m));
    out.push({
      ts: last.ts + m * MIN,
      mgdl: Math.round(clamp(yhat)),
      lo: Math.round(clamp(yhat - half)),
      hi: Math.round(clamp(yhat + half)),
    });
  }
  return {
    slope: round(slope, 2) as number,
    r2: syy > 0 ? round(1 - sse / syy, 2) : null,
    residualSd: round(s, 1) as number,
    basedOn: { from: first.ts, to: last.ts, count: n },
    anchor: last,
    points: out,
  };
}

/** Son `windowMin` dakikadaki ardışık ölçümler arasındaki medyan süre (dk). */
export function medianIntervalMin(points: readonly GlucosePoint[], windowMin = 60): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const end = (sorted[sorted.length - 1] as GlucosePoint).ts;
  const recent = sorted.filter((p) => p.ts >= end - windowMin * MIN);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++)
    gaps.push(((recent[i] as GlucosePoint).ts - (recent[i - 1] as GlucosePoint).ts) / MIN);
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2
      ? (gaps[mid] as number)
      : ((gaps[mid - 1] as number) + (gaps[mid] as number)) / 2;
  return round(median, 1);
}
