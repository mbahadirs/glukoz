import { GLUCOSE_THRESHOLDS as T, type RangeShare, type TimeInRanges } from '@glukoz/shared';
import type { Slot } from './resample.js';
import { round } from './stats.js';

const MIN_PER_DAY = 1440;

function share(n: number, total: number): RangeShare {
  if (total === 0) return { percent: 0, minutesPerDay: 0 };
  const pct = (n / total) * 100;
  return { percent: round(pct, 1) as number, minutesPerDay: Math.round((pct / 100) * MIN_PER_DAY) };
}

/**
 * Aralıkta kalma yüzdeleri — dolu dilim sayısına göre.
 * Konsensüs: veryLow <54, low 54–69, inRange 70–180, high 181–250, veryHigh >250, TITR 70–140.
 */
export function timeInRanges(
  slots: readonly Slot[],
  targetLow: number = T.LOW,
  targetHigh: number = T.HIGH,
): TimeInRanges {
  let vl = 0,
    l = 0,
    ir = 0,
    h = 0,
    vh = 0,
    tight = 0,
    target = 0;
  for (const { mgdl: v } of slots) {
    if (v < T.VERY_LOW) vl++;
    else if (v < T.LOW) l++;
    else if (v <= T.HIGH) ir++;
    else if (v <= T.VERY_HIGH) h++;
    else vh++;
    if (v >= T.LOW && v <= T.TIGHT_HIGH) tight++;
    if (v >= targetLow && v <= targetHigh) target++;
  }
  const n = slots.length;
  return {
    veryLow: share(vl, n),
    low: share(l, n),
    inRange: share(ir, n),
    high: share(h, n),
    veryHigh: share(vh, n),
    tightRange: share(tight, n),
    inTarget: share(target, n),
  };
}
