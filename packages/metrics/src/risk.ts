import type { GriResult, GriZone, RiskIndices, TimeInRanges } from '@glukoz/shared';
import type { Slot } from './resample.js';
import { round } from './stats.js';

/** Glycemia Risk Index (Klonoff 2022). Girdi yüzdeleri 0–100. */
export function glycemiaRiskIndex(
  tir: Pick<TimeInRanges, 'veryLow' | 'low' | 'high' | 'veryHigh'>,
): GriResult {
  const hypo = tir.veryLow.percent + 0.8 * tir.low.percent;
  const hyper = tir.veryHigh.percent + 0.5 * tir.high.percent;
  const gri = Math.min(100, 3 * hypo + 1.6 * hyper);
  return {
    gri: round(gri, 1) as number,
    hypoComponent: round(hypo, 1) as number,
    hyperComponent: round(hyper, 1) as number,
    zone: griZone(gri),
  };
}

export function griZone(gri: number): GriZone {
  if (gri <= 20) return 'A';
  if (gri <= 40) return 'B';
  if (gri <= 60) return 'C';
  if (gri <= 80) return 'D';
  return 'E';
}

/** Kovatchev LBGI / HBGI. */
export function riskIndices(slots: readonly Slot[]): RiskIndices {
  const valid = slots.filter((s) => s.mgdl > 0);
  if (valid.length === 0) return { lbgi: null, hbgi: null };
  let lo = 0;
  let hi = 0;
  for (const { mgdl } of valid) {
    const f = 1.509 * (Math.log(mgdl) ** 1.084 - 5.381);
    const r = 10 * f * f;
    if (f < 0) lo += r;
    else if (f > 0) hi += r;
  }
  return { lbgi: round(lo / valid.length, 2), hbgi: round(hi / valid.length, 2) };
}
