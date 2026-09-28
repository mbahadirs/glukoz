import { SLOT_MS, type GlucosePoint } from '@glukoz/shared';

/** 5 dakikalık UTC dilimi; `ts` dilim başlangıcı. */
export type Slot = GlucosePoint;

/**
 * Okumaları UTC'de 5 dk'lık dilimlere böler, her dilimin ortalamasını alır.
 * Boş dilimler doldurulmaz. Çıktı zamana göre artan sıralıdır.
 */
export function resample5m(points: readonly GlucosePoint[]): Slot[] {
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of points) {
    if (!Number.isFinite(p.mgdl) || !Number.isFinite(p.ts)) continue;
    const key = p.ts - (((p.ts % SLOT_MS) + SLOT_MS) % SLOT_MS);
    const b = buckets.get(key);
    if (b) {
      b.sum += p.mgdl;
      b.n += 1;
    } else buckets.set(key, { sum: p.mgdl, n: 1 });
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, b]) => ({ ts, mgdl: b.sum / b.n }));
}

export function slotsInRange(slots: readonly Slot[], from: number, to: number): Slot[] {
  return slots.filter((s) => s.ts >= from && s.ts < to);
}

export function expectedSlots(from: number, to: number): number {
  return Math.max(0, Math.ceil((to - from) / SLOT_MS));
}

/**
 * Grafik için: ≤ maxGapMin boşlukları birleştir, daha uzun boşlukta `null` ekleyerek çizgiyi kes.
 */
export function withGapBreaks(
  slots: readonly Slot[],
  maxGapMin = 20,
): Array<[number, number | null]> {
  const out: Array<[number, number | null]> = [];
  let prev: Slot | undefined;
  for (const s of slots) {
    if (prev && s.ts - prev.ts > maxGapMin * 60_000) out.push([prev.ts + SLOT_MS, null]);
    out.push([s.ts, s.mgdl]);
    prev = s;
  }
  return out;
}
