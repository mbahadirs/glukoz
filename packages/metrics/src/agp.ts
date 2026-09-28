import type { AgpBucket } from '@glukoz/shared';
import type { Slot } from './resample.js';
import { percentileSorted, round, sortedCopy } from './stats.js';
import { minuteOfDay } from './time.js';

export const AGP_BUCKETS = 96;
const BUCKET_MIN = 15;
const PERCENTILES = [
  ['p5', 0.05],
  ['p25', 0.25],
  ['p50', 0.5],
  ['p75', 0.75],
  ['p95', 0.95],
] as const;
type PKey = (typeof PERCENTILES)[number][0];

/**
 * Ambulatory Glucose Profile: dilim değerleri hasta saatine göre 96 × 15 dk kovaya yerleşir.
 * Kovada < minCount değer varsa yüzdelikler null. Eğriler merkezli 3 kovalık (dairesel) hareketli
 * ortalama ile yumuşatılır; null komşular ortalamaya katılmaz.
 */
export function agp(slots: readonly Slot[], tz: string, minCount = 5): AgpBucket[] {
  const buckets: number[][] = Array.from({ length: AGP_BUCKETS }, () => []);
  for (const s of slots) {
    const idx = Math.floor(minuteOfDay(s.ts, tz) / BUCKET_MIN);
    buckets[idx]?.push(s.mgdl);
  }
  const raw = buckets.map((values) => {
    if (values.length < minCount) return null;
    const sorted = sortedCopy(values);
    const r = {} as Record<PKey, number>;
    for (const [k, p] of PERCENTILES) r[k] = percentileSorted(sorted, p) as number;
    return r;
  });
  return raw.map((cur, i) => {
    const base: AgpBucket = {
      index: i,
      minuteOfDay: i * BUCKET_MIN,
      count: buckets[i]?.length ?? 0,
      p5: null,
      p25: null,
      p50: null,
      p75: null,
      p95: null,
    };
    if (!cur) return base;
    const neighbors = [
      raw[(i - 1 + AGP_BUCKETS) % AGP_BUCKETS],
      cur,
      raw[(i + 1) % AGP_BUCKETS],
    ].filter((x): x is Record<PKey, number> => x !== null && x !== undefined);
    const smoothed = { ...base };
    for (const [k] of PERCENTILES) {
      smoothed[k] = round(neighbors.reduce((a, n) => a + n[k], 0) / neighbors.length, 1);
    }
    return smoothed;
  });
}
