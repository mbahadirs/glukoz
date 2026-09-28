import {
  DATA_SUFFICIENCY_MIN_PERCENT,
  type GlucosePoint,
  type GlucoseReport,
} from '@glukoz/shared';
import { agp } from './agp.js';
import { dailySummaries, hourDayHeatmap, periodSummaries, weekdaySummaries } from './analysis.js';
import { basicStats } from './basic.js';
import { detectEvents, summarizeEvents, type EventOptions } from './events.js';
import { mealAnalysis, type MealNote } from './meals.js';
import { timeInRanges } from './ranges.js';
import { resample5m, slotsInRange } from './resample.js';
import { glycemiaRiskIndex, riskIndices } from './risk.js';
import { dateKey } from './time.js';

export interface ReportOptions {
  from: number;
  to: number;
  timezone: string;
  targetLow?: number;
  targetHigh?: number;
  meals?: readonly MealNote[];
  eventOptions?: Partial<EventOptions>;
  includeDailySlots?: boolean;
}

/** Bölüm 8'deki tüm metrikleri tek geçişte üretir. */
export function buildReport(points: readonly GlucosePoint[], o: ReportOptions): GlucoseReport {
  const slots = slotsInRange(resample5m(points), o.from, o.to);
  const tz = o.timezone;
  const stats = basicStats(slots, o.from, o.to);
  const tir = timeInRanges(slots, o.targetLow, o.targetHigh);
  const events = detectEvents(slots, tz, o.eventOptions);
  return {
    from: o.from,
    to: o.to,
    days: Math.round((o.to - o.from) / 86_400_000),
    timezone: tz,
    targetLow: o.targetLow ?? 70,
    targetHigh: o.targetHigh ?? 180,
    stats,
    tir,
    gri: glycemiaRiskIndex(tir),
    risk: riskIndices(slots),
    agp: agp(slots, tz),
    events,
    eventSummary: summarizeEvents(events),
    daily: dailySummaries(slots, events, tz, o.from, o.to, o.includeDailySlots ?? false),
    periods: periodSummaries(slots, events, tz),
    weekdays: weekdaySummaries(slots, tz),
    heatmap: hourDayHeatmap(slots, tz, o.from, o.to),
    meals: mealAnalysis(slots, o.meals ?? [], tz),
    sensorDays: new Set(slots.map((s) => dateKey(s.ts, tz))).size,
    insufficientData: stats.sufficiencyPercent < DATA_SUFFICIENCY_MIN_PERCENT,
  };
}
