import { describe, expect, it } from 'vitest';
import { buildReport } from './report.js';
import { compareDirection, compareReports } from './compare.js';
import { MIN, repeat, series, T0 } from './test-helpers.js';

const DAY = 1440 * MIN;

describe('buildReport', () => {
  it('tüm bölümleri üretir', () => {
    const pts = series(T0, [...repeat(120, 200), ...repeat(60, 6), ...repeat(120, 82)]);
    const r = buildReport(pts, {
      from: T0,
      to: T0 + DAY,
      timezone: 'UTC',
      includeDailySlots: true,
    });
    expect(r.days).toBe(1);
    expect(r.stats.count).toBe(288);
    expect(r.stats.sufficiencyPercent).toBe(100);
    expect(r.insufficientData).toBe(false);
    expect(r.tir.low.percent).toBe(2.1);
    expect(r.eventSummary.hypoL1).toBe(1);
    expect(r.agp).toHaveLength(96);
    expect(r.daily).toHaveLength(1);
    expect(r.daily[0]?.slots).toHaveLength(288);
    expect(r.heatmap).toHaveLength(24);
    expect(r.periods).toHaveLength(4);
    expect(r.weekdays).toHaveLength(7);
    expect(r.sensorDays).toBe(1);
    expect(r.targetLow).toBe(70);
    expect(r.meals.responses).toEqual([]);
  });

  it('veri yetersizliği işaretlenir', () => {
    const r = buildReport(series(T0, repeat(100, 10)), {
      from: T0,
      to: T0 + DAY,
      timezone: 'UTC',
      targetLow: 80,
      targetHigh: 160,
    });
    expect(r.insufficientData).toBe(true);
    expect(r.targetLow).toBe(80);
  });
});

describe('compareReports', () => {
  it('yön ve fark', () => {
    const good = buildReport(series(T0, repeat(120, 288)), {
      from: T0,
      to: T0 + DAY,
      timezone: 'UTC',
    });
    const bad = buildReport(series(T0 - DAY, [...repeat(120, 144), ...repeat(260, 144)]), {
      from: T0 - DAY,
      to: T0,
      timezone: 'UTC',
    });
    const c = compareReports(good, bad);
    const by = Object.fromEntries(c.metrics.map((m) => [m.key, m]));
    expect(by.inRange).toMatchObject({ current: 100, previous: 50, diff: 50, direction: 'better' });
    expect(by.veryHigh?.direction).toBe('better');
    expect(by.mean?.direction).toBe('neutral');
    expect(by.belowRange?.direction).toBe('same');
    expect(by.cv).toMatchObject({ current: 0, direction: 'better' });
    expect(c.previous.from).toBe(T0 - DAY);
  });

  it('compareDirection', () => {
    expect(compareDirection(null, 'lower')).toBe('neutral');
    expect(compareDirection(2, 'lower')).toBe('worse');
    expect(compareDirection(-2, 'higher')).toBe('worse');
    expect(compareDirection(0.01, 'higher')).toBe('same');
  });
});
