import { MGDL_PER_MMOL, type BasicStats } from '@glukoz/shared';
import { expectedSlots, type Slot } from './resample.js';
import { mean, percentileSorted, round, sampleSd, sortedCopy } from './stats.js';

export function gmiPercent(meanMgdl: number): number {
  return 3.31 + 0.02392 * meanMgdl;
}

export function gmiMmolMol(meanMgdl: number): number {
  return 12.71 + 4.70587 * (meanMgdl / MGDL_PER_MMOL);
}

export function basicStats(slots: readonly Slot[], from: number, to: number): BasicStats {
  const values = slots.map((s) => s.mgdl);
  const expected = expectedSlots(from, to);
  const m = mean(values);
  const sd = sampleSd(values);
  const sorted = sortedCopy(values);
  const q1 = percentileSorted(sorted, 0.25);
  const q3 = percentileSorted(sorted, 0.75);
  return {
    count: values.length,
    expectedSlots: expected,
    mean: round(m, 1),
    sd: round(sd, 1),
    cv: m !== null && sd !== null && m > 0 ? round((sd / m) * 100, 1) : null,
    gmiPercent: m !== null ? round(gmiPercent(m), 1) : null,
    gmiMmolMol: m !== null ? round(gmiMmolMol(m), 0) : null,
    sufficiencyPercent:
      expected > 0 ? (round(Math.min(100, (values.length / expected) * 100), 1) as number) : 0,
    min: sorted.length ? (sorted[0] as number) : null,
    max: sorted.length ? (sorted[sorted.length - 1] as number) : null,
    median: round(percentileSorted(sorted, 0.5), 1),
    q1: round(q1, 1),
    q3: round(q3, 1),
    iqr: q1 !== null && q3 !== null ? round(q3 - q1, 1) : null,
  };
}
