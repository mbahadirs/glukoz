/** Metrik paketinin çıktı sözleşmesi. Uygulama `packages/metrics`, tüketiciler API ve web. */

export interface GlucosePoint {
  /** ms, UTC */
  ts: number;
  mgdl: number;
}

export interface BasicStats {
  count: number;
  expectedSlots: number;
  mean: number | null;
  sd: number | null;
  cv: number | null;
  gmiPercent: number | null;
  gmiMmolMol: number | null;
  sufficiencyPercent: number;
  min: number | null;
  max: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
}

export interface RangeShare {
  percent: number;
  minutesPerDay: number;
}

export interface TimeInRanges {
  veryLow: RangeShare;
  low: RangeShare;
  inRange: RangeShare;
  high: RangeShare;
  veryHigh: RangeShare;
  tightRange: RangeShare;
  /** Hastaya özel hedef (targetLow..targetHigh) */
  inTarget: RangeShare;
}

export type EventKind = 'hypo_l1' | 'hypo_l2' | 'hyper';

export interface GlycemicEvent {
  kind: EventKind;
  start: number;
  end: number;
  durationMin: number;
  /** hipo için nadir, hiper için zirve */
  extremeMgdl: number;
  extremeTs: number;
  nocturnal: boolean;
  prolonged: boolean;
  /** veri sonunda hâlâ sürüyor */
  ongoing: boolean;
}

export interface EventSummary {
  total: number;
  hypoL1: number;
  hypoL2: number;
  hyper: number;
  nocturnalHypo: number;
  prolongedHypo: number;
  prolongedHyper: number;
  avgHypoDurationMin: number | null;
  avgHyperDurationMin: number | null;
}

export type GriZone = 'A' | 'B' | 'C' | 'D' | 'E';

export interface GriResult {
  gri: number;
  hypoComponent: number;
  hyperComponent: number;
  zone: GriZone;
}

export interface RiskIndices {
  lbgi: number | null;
  hbgi: number | null;
}

export interface AgpBucket {
  /** 0..95 — 15 dk'lık kova */
  index: number;
  minuteOfDay: number;
  count: number;
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD (hasta saat dilimi)
  mean: number | null;
  min: number | null;
  max: number | null;
  tir: Pick<TimeInRanges, 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh'>;
  eventCount: number;
  sufficiencyPercent: number;
  /** küçük çoklu grafik için 5 dk dilimler (ms, mg/dL) */
  slots?: Array<[number, number]>;
}

export type DayPeriod = 'night' | 'morning' | 'afternoon' | 'evening';

export interface PeriodSummary {
  period: DayPeriod;
  mean: number | null;
  tirPercent: number | null;
  hypoCount: number;
  count: number;
}

export interface WeekdaySummary {
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number;
  mean: number | null;
  tirPercent: number | null;
  count: number;
}

export interface HeatmapCell {
  date: string;
  hour: number;
  mean: number | null;
  outOfRangeMin: number;
  count: number;
}

export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealResponse {
  noteId: string;
  ts: number;
  mealKind: MealKind;
  carbsG: number | null;
  preMgdl: number | null;
  at1hMgdl: number | null;
  at2hMgdl: number | null;
  peakMgdl: number | null;
  minutesToPeak: number | null;
}

export interface MealKindAverage {
  mealKind: MealKind;
  count: number;
  preMgdl: number | null;
  at1hMgdl: number | null;
  at2hMgdl: number | null;
  peakMgdl: number | null;
  minutesToPeak: number | null;
}

export interface GlucoseReport {
  from: number;
  to: number;
  days: number;
  timezone: string;
  targetLow: number;
  targetHigh: number;
  stats: BasicStats;
  tir: TimeInRanges;
  gri: GriResult;
  risk: RiskIndices;
  agp: AgpBucket[];
  events: GlycemicEvent[];
  eventSummary: EventSummary;
  daily: DailySummary[];
  periods: PeriodSummary[];
  weekdays: WeekdaySummary[];
  heatmap: HeatmapCell[];
  meals: { responses: MealResponse[]; averages: MealKindAverage[] };
  sensorDays: number;
  insufficientData: boolean;
}

export type CompareDirection = 'better' | 'worse' | 'same' | 'neutral';

export interface MetricComparison {
  key: string;
  current: number | null;
  previous: number | null;
  diff: number | null;
  direction: CompareDirection;
}

export interface ReportComparison {
  current: { from: number; to: number };
  previous: { from: number; to: number };
  metrics: MetricComparison[];
}
