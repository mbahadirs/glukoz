import type { GlucosePoint } from '@glukoz/shared';

/**
 * Canlı ekran deltası: son değer − ~5 dk önceki değer. 3–8 dk önce okuma yoksa null.
 * Projeksiyon bilinçli olarak hesaplanmaz (tedavi kararına yol açabilir).
 */
export function liveDelta(points: readonly GlucosePoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const last = sorted[sorted.length - 1] as GlucosePoint;
  const target = last.ts - 5 * 60_000;
  let best: GlucosePoint | null = null;
  for (const p of sorted) {
    const age = last.ts - p.ts;
    if (age < 3 * 60_000 || age > 8 * 60_000) continue;
    if (!best || Math.abs(p.ts - target) < Math.abs(best.ts - target)) best = p;
  }
  return best ? Math.round(last.mgdl - best.mgdl) : null;
}
