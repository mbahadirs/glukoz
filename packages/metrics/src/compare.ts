import type {
  CompareDirection,
  GlucoseReport,
  MetricComparison,
  ReportComparison,
} from '@glukoz/shared';
import { round } from './stats.js';

type Better = 'lower' | 'higher' | 'neutral';

const METRICS: Array<{ key: string; better: Better; get: (r: GlucoseReport) => number | null }> = [
  // Ortalama ve GMI: düşmesi hipo artışıyla da olabilir → nötr gösterilir.
  { key: 'mean', better: 'neutral', get: (r) => r.stats.mean },
  { key: 'gmiPercent', better: 'neutral', get: (r) => r.stats.gmiPercent },
  { key: 'cv', better: 'lower', get: (r) => r.stats.cv },
  { key: 'sufficiencyPercent', better: 'higher', get: (r) => r.stats.sufficiencyPercent },
  { key: 'inRange', better: 'higher', get: (r) => r.tir.inRange.percent },
  { key: 'tightRange', better: 'higher', get: (r) => r.tir.tightRange.percent },
  { key: 'belowRange', better: 'lower', get: (r) => r.tir.veryLow.percent + r.tir.low.percent },
  { key: 'veryLow', better: 'lower', get: (r) => r.tir.veryLow.percent },
  { key: 'aboveRange', better: 'lower', get: (r) => r.tir.high.percent + r.tir.veryHigh.percent },
  { key: 'veryHigh', better: 'lower', get: (r) => r.tir.veryHigh.percent },
  { key: 'gri', better: 'lower', get: (r) => r.gri.gri },
  { key: 'hypoEvents', better: 'lower', get: (r) => r.eventSummary.hypoL1 },
];

export function compareDirection(
  diff: number | null,
  better: Better,
  epsilon = 0.05,
): CompareDirection {
  if (diff === null) return 'neutral';
  if (Math.abs(diff) < epsilon) return 'same';
  if (better === 'neutral') return 'neutral';
  const improved = better === 'lower' ? diff < 0 : diff > 0;
  return improved ? 'better' : 'worse';
}

export function compareReports(current: GlucoseReport, previous: GlucoseReport): ReportComparison {
  const metrics: MetricComparison[] = METRICS.map(({ key, better, get }) => {
    const c = get(current);
    const p = get(previous);
    const diff = c !== null && p !== null ? round(c - p, 1) : null;
    return {
      key,
      current: c === null ? null : round(c, 1),
      previous: p === null ? null : round(p, 1),
      diff,
      direction: compareDirection(diff, better),
    };
  });
  return {
    current: { from: current.from, to: current.to },
    previous: { from: previous.from, to: previous.to },
    metrics,
  };
}
