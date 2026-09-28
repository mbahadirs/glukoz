import { describe, expect, it } from 'vitest';
import { expectedSlots, resample5m, slotsInRange, withGapBreaks } from './resample.js';
import { MIN, T0 } from './test-helpers.js';

describe('resample5m', () => {
  it('dakikalık okumaları 5 dk dilim ortalamasına indirger', () => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ ts: T0 + i * MIN, mgdl: 100 + i * 10 }));
    pts.push({ ts: T0 + 5 * MIN, mgdl: 90 });
    expect(resample5m(pts)).toEqual([
      { ts: T0, mgdl: 120 },
      { ts: T0 + 5 * MIN, mgdl: 90 },
    ]);
  });
  it('sıralamaz girdiyi sıralar, geçersiz değerleri atlar, boş dilim doldurmaz', () => {
    const r = resample5m([
      { ts: T0 + 20 * MIN, mgdl: 150 },
      { ts: T0, mgdl: 100 },
      { ts: T0 + 3 * MIN, mgdl: Number.NaN },
    ]);
    expect(r.map((s) => s.ts)).toEqual([T0, T0 + 20 * MIN]);
  });
  it('epoch öncesi zaman damgası da doğru dilime düşer', () => {
    expect(resample5m([{ ts: -1, mgdl: 1 }])[0]?.ts).toBe(-5 * MIN);
  });
  it('yardımcılar', () => {
    expect(expectedSlots(T0, T0 + 60 * MIN)).toBe(12);
    expect(expectedSlots(T0, T0)).toBe(0);
    const slots = [
      { ts: T0, mgdl: 1 },
      { ts: T0 + 10 * MIN, mgdl: 2 },
    ];
    expect(slotsInRange(slots, T0 + 1, T0 + 20 * MIN)).toHaveLength(1);
  });
  it('withGapBreaks > 20 dk boşlukta çizgiyi keser', () => {
    const slots = [
      { ts: T0, mgdl: 100 },
      { ts: T0 + 20 * MIN, mgdl: 110 },
      { ts: T0 + 45 * MIN, mgdl: 120 },
    ];
    expect(withGapBreaks(slots)).toEqual([
      [T0, 100],
      [T0 + 20 * MIN, 110],
      [T0 + 25 * MIN, null],
      [T0 + 45 * MIN, 120],
    ]);
  });
});
