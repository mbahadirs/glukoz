import type { GlucosePoint } from '@glukoz/shared';

export const MIN = 60_000;
export const T0 = Date.UTC(2026, 0, 5, 0, 0); // 2026-01-05 Pazartesi 00:00 UTC

/** Her 5 dk'da bir değer üretir. */
export function series(start: number, values: readonly number[], stepMin = 5): GlucosePoint[] {
  return values.map((mgdl, i) => ({ ts: start + i * stepMin * MIN, mgdl }));
}

export function repeat(value: number, n: number): number[] {
  return Array.from({ length: n }, () => value);
}
