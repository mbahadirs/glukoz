import {
  GLUCOSE_THRESHOLDS as T,
  SLOT_MS,
  type DailySummary,
  type DayPeriod,
  type GlycemicEvent,
  type HeatmapCell,
  type PeriodSummary,
  type WeekdaySummary,
} from '@glukoz/shared';
import { expectedSlots, type Slot } from './resample.js';
import { timeInRanges } from './ranges.js';
import { mean, round } from './stats.js';
import { addDays, dateKey, datesInRange, zonedDayStart, zonedParts } from './time.js';

function tirPercent(values: readonly number[]): number | null {
  if (!values.length) return null;
  const n = values.filter((v) => v >= T.LOW && v <= T.HIGH).length;
  return round((n / values.length) * 100, 1);
}

function groupByDate(slots: readonly Slot[], tz: string): Map<string, Slot[]> {
  const m = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = dateKey(s.ts, tz);
    const arr = m.get(k);
    if (arr) arr.push(s);
    else m.set(k, [s]);
  }
  return m;
}

/** Her yerel gün için özet. `includeSlots` küçük çoklu grafikler için dilimleri ekler. */
export function dailySummaries(
  slots: readonly Slot[],
  events: readonly GlycemicEvent[],
  tz: string,
  from: number,
  to: number,
  includeSlots = false,
): DailySummary[] {
  const byDate = groupByDate(slots, tz);
  return datesInRange(from, to, tz).map((date) => {
    const dayStart = Math.max(from, zonedDayStart(date, tz));
    const dayEnd = Math.min(to, zonedDayStart(addDays(date, 1), tz));
    const daySlots = byDate.get(date) ?? [];
    const values = daySlots.map((s) => s.mgdl);
    const tir = timeInRanges(daySlots);
    const exp = expectedSlots(dayStart, dayEnd);
    const summary: DailySummary = {
      date,
      mean: round(mean(values), 1),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      tir: {
        veryLow: tir.veryLow,
        low: tir.low,
        inRange: tir.inRange,
        high: tir.high,
        veryHigh: tir.veryHigh,
      },
      eventCount: events.filter((e) => dateKey(e.start, tz) === date).length,
      sufficiencyPercent:
        exp > 0 ? (round(Math.min(100, (values.length / exp) * 100), 1) as number) : 0,
    };
    if (includeSlots) summary.slots = daySlots.map((s) => [s.ts, Math.round(s.mgdl)]);
    return summary;
  });
}

export function periodOfHour(hour: number): DayPeriod {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function periodSummaries(
  slots: readonly Slot[],
  events: readonly GlycemicEvent[],
  tz: string,
): PeriodSummary[] {
  const periods: DayPeriod[] = ['night', 'morning', 'afternoon', 'evening'];
  const values = new Map<DayPeriod, number[]>(periods.map((p) => [p, []]));
  for (const s of slots) values.get(periodOfHour(zonedParts(s.ts, tz).hour))?.push(s.mgdl);
  return periods.map((period) => {
    const v = values.get(period) ?? [];
    return {
      period,
      mean: round(mean(v), 1),
      tirPercent: tirPercent(v),
      hypoCount: events.filter(
        (e) => e.kind === 'hypo_l1' && periodOfHour(zonedParts(e.start, tz).hour) === period,
      ).length,
      count: v.length,
    };
  });
}

export function weekdaySummaries(slots: readonly Slot[], tz: string): WeekdaySummary[] {
  const values: number[][] = Array.from({ length: 7 }, () => []);
  for (const s of slots) values[zonedParts(s.ts, tz).weekday - 1]?.push(s.mgdl);
  return values.map((v, i) => ({
    weekday: i + 1,
    mean: round(mean(v), 1),
    tirPercent: tirPercent(v),
    count: v.length,
  }));
}

/** Saat × gün ısı haritası: hücre = ortalama ve hedef aralık (70–180) dışı dakika. */
export function hourDayHeatmap(
  slots: readonly Slot[],
  tz: string,
  from: number,
  to: number,
): HeatmapCell[] {
  const cells = new Map<string, number[]>();
  for (const s of slots) {
    const p = zonedParts(s.ts, tz);
    const k = `${dateKey(s.ts, tz)}|${p.hour}`;
    const arr = cells.get(k);
    if (arr) arr.push(s.mgdl);
    else cells.set(k, [s.mgdl]);
  }
  const out: HeatmapCell[] = [];
  for (const date of datesInRange(from, to, tz)) {
    for (let hour = 0; hour < 24; hour++) {
      const v = cells.get(`${date}|${hour}`) ?? [];
      out.push({
        date,
        hour,
        mean: round(mean(v), 0),
        outOfRangeMin: v.filter((x) => x < T.LOW || x > T.HIGH).length * (SLOT_MS / 60_000),
        count: v.length,
      });
    }
  }
  return out;
}

/** Ardışık dilimlerden değişim hızı (mg/dL/dk). Boşluk > maxGapMin ise atlanır. */
export function rateOfChange(
  slots: readonly Slot[],
  maxGapMin = 15,
): Array<{ ts: number; rate: number }> {
  const out: Array<{ ts: number; rate: number }> = [];
  for (let i = 1; i < slots.length; i++) {
    const a = slots[i - 1] as Slot;
    const b = slots[i] as Slot;
    const dtMin = (b.ts - a.ts) / 60_000;
    if (dtMin <= 0 || dtMin > maxGapMin) continue;
    out.push({ ts: b.ts, rate: round((b.mgdl - a.mgdl) / dtMin, 2) as number });
  }
  return out;
}
