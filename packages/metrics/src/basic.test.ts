import { describe, expect, it } from 'vitest';
import { basicStats, gmiMmolMol, gmiPercent } from './basic.js';
import { MIN, T0 } from './test-helpers.js';

describe('basicStats', () => {
  it('bilinen girdi', () => {
    const slots = [100, 120, 140, 160].map((mgdl, i) => ({ ts: T0 + i * 5 * MIN, mgdl }));
    const s = basicStats(slots, T0, T0 + 40 * MIN);
    expect(s.count).toBe(4);
    expect(s.expectedSlots).toBe(8);
    expect(s.mean).toBe(130);
    expect(s.sd).toBe(25.8); // sqrt(2000/3)
    expect(s.cv).toBe(19.9);
    expect(s.gmiPercent).toBe(6.4); // 3.31 + 0.02392*130 = 6.4196
    expect(s.gmiMmolMol).toBe(47);
    expect(s.sufficiencyPercent).toBe(50);
    expect(s.min).toBe(100);
    expect(s.max).toBe(160);
    expect(s.median).toBe(130);
    expect(s.q1).toBe(115);
    expect(s.q3).toBe(145);
    expect(s.iqr).toBe(30);
  });
  it('boş dizi', () => {
    const s = basicStats([], T0, T0 + 60 * MIN);
    expect(s).toMatchObject({
      count: 0,
      mean: null,
      sd: null,
      cv: null,
      gmiPercent: null,
      min: null,
      sufficiencyPercent: 0,
    });
    expect(basicStats([], T0, T0).sufficiencyPercent).toBe(0);
  });
  it('tek değer: sd yok', () => {
    const s = basicStats([{ ts: T0, mgdl: 154 }], T0, T0 + 5 * MIN);
    expect(s.sd).toBeNull();
    expect(s.cv).toBeNull();
    expect(s.sufficiencyPercent).toBe(100);
  });
  it('GMI formülleri', () => {
    expect(gmiPercent(154)).toBeCloseTo(6.99368, 5);
    expect(gmiMmolMol(154)).toBeCloseTo(12.71 + 4.70587 * (154 / 18.0182), 5);
  });
});
