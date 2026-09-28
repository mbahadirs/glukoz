import type { MealKind, MealKindAverage, MealResponse } from '@glukoz/shared';
import type { Slot } from './resample.js';
import { mean, round } from './stats.js';
import { zonedParts } from './time.js';

export interface MealNote {
  id: string;
  ts: number;
  carbsG: number | null;
}

/** Öğün türünü yerel saatten tahmin eder. */
export function mealKindOf(ts: number, tz: string): MealKind {
  const h = zonedParts(ts, tz).hour;
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 22) return 'dinner';
  return 'snack';
}

function nearest(slots: readonly Slot[], ts: number, toleranceMin: number): number | null {
  let best: Slot | null = null;
  for (const s of slots) {
    const d = Math.abs(s.ts - ts);
    if (d > toleranceMin * 60_000) continue;
    if (!best || d < Math.abs(best.ts - ts)) best = s;
  }
  return best ? Math.round(best.mgdl) : null;
}

export function mealResponse(slots: readonly Slot[], meal: MealNote, tz: string): MealResponse {
  const pre = slots
    .filter((s) => s.ts >= meal.ts - 15 * 60_000 && s.ts <= meal.ts)
    .map((s) => s.mgdl);
  const post = slots.filter((s) => s.ts > meal.ts && s.ts <= meal.ts + 180 * 60_000);
  let peak: Slot | null = null;
  for (const s of post) if (!peak || s.mgdl > peak.mgdl) peak = s;
  return {
    noteId: meal.id,
    ts: meal.ts,
    mealKind: mealKindOf(meal.ts, tz),
    carbsG: meal.carbsG,
    preMgdl: round(mean(pre), 0),
    at1hMgdl: nearest(slots, meal.ts + 60 * 60_000, 10),
    at2hMgdl: nearest(slots, meal.ts + 120 * 60_000, 10),
    peakMgdl: peak ? Math.round(peak.mgdl) : null,
    minutesToPeak: peak ? Math.round((peak.ts - meal.ts) / 60_000) : null,
  };
}

function avgOf(values: Array<number | null>): number | null {
  return round(mean(values.filter((v): v is number => v !== null)), 0);
}

export function mealAnalysis(
  slots: readonly Slot[],
  meals: readonly MealNote[],
  tz: string,
): { responses: MealResponse[]; averages: MealKindAverage[] } {
  const responses = meals.map((m) => mealResponse(slots, m, tz));
  const kinds: MealKind[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const averages = kinds
    .map((mealKind) => {
      const r = responses.filter((x) => x.mealKind === mealKind);
      return {
        mealKind,
        count: r.length,
        preMgdl: avgOf(r.map((x) => x.preMgdl)),
        at1hMgdl: avgOf(r.map((x) => x.at1hMgdl)),
        at2hMgdl: avgOf(r.map((x) => x.at2hMgdl)),
        peakMgdl: avgOf(r.map((x) => x.peakMgdl)),
        minutesToPeak: avgOf(r.map((x) => x.minutesToPeak)),
      };
    })
    .filter((a) => a.count > 0);
  return { responses, averages };
}
