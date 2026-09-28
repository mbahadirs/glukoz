import { describe, expect, it } from 'vitest';
import {
  dailySummaries,
  hourDayHeatmap,
  periodOfHour,
  periodSummaries,
  rateOfChange,
  weekdaySummaries,
} from './analysis.js';
import { detectEvents } from './events.js';
import { resample5m } from './resample.js';
import { MIN, repeat, series, T0 } from './test-helpers.js';

const DAY = 1440 * MIN;

describe('dailySummaries', () => {
  it('her gün için özet ve yeterlilik', () => {
    const slots = resample5m([
      ...series(T0, repeat(100, 288)), // 1. gün tam
      ...series(T0 + DAY, repeat(200, 144)), // 2. gün yarım
    ]);
    const days = dailySummaries(slots, [], 'UTC', T0, T0 + 3 * DAY, true);
    expect(days.map((d) => d.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07']);
    expect(days[0]).toMatchObject({ mean: 100, min: 100, max: 100, sufficiencyPercent: 100 });
    expect(days[0]?.tir.inRange.percent).toBe(100);
    expect(days[1]).toMatchObject({ mean: 200, sufficiencyPercent: 50 });
    expect(days[1]?.tir.high.percent).toBe(100);
    expect(days[2]).toMatchObject({ mean: null, min: null, sufficiencyPercent: 0 });
    expect(days[0]?.slots).toHaveLength(288);
  });

  it('olay sayısı güne göre', () => {
    const slots = resample5m(series(T0 + 12 * 60 * MIN, [60, 60, 60, 100, 100, 100]));
    const events = detectEvents(slots, 'UTC');
    const days = dailySummaries(slots, events, 'UTC', T0, T0 + DAY);
    expect(days[0]?.eventCount).toBe(1);
    expect(days[0]?.slots).toBeUndefined();
  });
});

describe('periods / weekday / heatmap', () => {
  it('periodOfHour', () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(periodOfHour)).toEqual([
      'night',
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
    ]);
  });

  it('günün dilimleri', () => {
    const slots = resample5m([
      ...series(T0 + 2 * 60 * MIN, [60, 60, 60, 100, 100, 100]), // gece
      ...series(T0 + 13 * 60 * MIN, [200, 200]), // öğleden sonra
    ]);
    const p = periodSummaries(slots, detectEvents(slots, 'UTC'), 'UTC');
    expect(p.find((x) => x.period === 'night')).toMatchObject({
      hypoCount: 1,
      count: 6,
      tirPercent: 50,
      mean: 80,
    });
    expect(p.find((x) => x.period === 'afternoon')).toMatchObject({ mean: 200, tirPercent: 0 });
    expect(p.find((x) => x.period === 'morning')).toMatchObject({
      mean: null,
      tirPercent: null,
      count: 0,
    });
  });

  it('haftanın günü (T0 Pazartesi)', () => {
    const slots = resample5m([...series(T0, [100]), ...series(T0 + 6 * DAY, [300])]);
    const w = weekdaySummaries(slots, 'UTC');
    expect(w[0]).toMatchObject({ weekday: 1, mean: 100, tirPercent: 100 });
    expect(w[6]).toMatchObject({ weekday: 7, mean: 300, tirPercent: 0 });
    expect(w[3]?.mean).toBeNull();
  });

  it('ısı haritası', () => {
    const slots = resample5m(series(T0 + 3 * 60 * MIN, [100, 200, 50]));
    const h = hourDayHeatmap(slots, 'UTC', T0, T0 + DAY);
    expect(h).toHaveLength(24);
    expect(h[3]).toMatchObject({
      date: '2026-01-05',
      hour: 3,
      mean: 117,
      outOfRangeMin: 10,
      count: 3,
    });
    expect(h[4]).toMatchObject({ mean: null, outOfRangeMin: 0 });
  });
});

describe('rateOfChange', () => {
  it('mg/dL/dk ve boşluk atlama', () => {
    const slots = resample5m([...series(T0, [100, 110, 105]), ...series(T0 + 60 * MIN, [200])]);
    expect(rateOfChange(slots)).toEqual([
      { ts: T0 + 5 * MIN, rate: 2 },
      { ts: T0 + 10 * MIN, rate: -1 },
    ]);
  });
});
