/** Temel sayısal yardımcılar. */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** Örneklem standart sapması (n − 1). */
export function sampleSd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  let s = 0;
  for (const v of values) s += (v - m) ** 2;
  return Math.sqrt(s / (values.length - 1));
}

/** Doğrusal enterpolasyonlu yüzdelik (R tip 7). `sorted` artan sıralı olmalı. */
export function percentileSorted(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (h - lo) * (b - a);
}

export function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
