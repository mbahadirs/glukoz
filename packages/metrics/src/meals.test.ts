import { describe, expect, it } from 'vitest';
import { mealAnalysis, mealKindOf, mealResponse } from './meals.js';
import { resample5m } from './resample.js';
import { MIN, series, T0 } from './test-helpers.js';

describe('meals', () => {
  it('öğün türü saatten tahmin', () => {
    expect(mealKindOf(T0 + 8 * 60 * MIN, 'UTC')).toBe('breakfast');
    expect(mealKindOf(T0 + 13 * 60 * MIN, 'UTC')).toBe('lunch');
    expect(mealKindOf(T0 + 19 * 60 * MIN, 'UTC')).toBe('dinner');
    expect(mealKindOf(T0 + 23 * 60 * MIN, 'UTC')).toBe('snack');
    expect(mealKindOf(T0 + 5 * 60 * MIN, 'Europe/Istanbul')).toBe('breakfast'); // 08:00 yerel
  });

  it('öğün sonrası yanıt', () => {
    const meal = T0 + 8 * 60 * MIN;
    // −15..+180 dk; 5 dk adım: öncesi 100, sonra 60. dk'da 180 zirve, 120. dk'da 140
    const values: number[] = [];
    for (let m = -15; m <= 180; m += 5) {
      if (m <= 0) values.push(100);
      else if (m <= 60) values.push(100 + (m / 60) * 80);
      else values.push(Math.max(100, 180 - ((m - 60) / 60) * 40));
    }
    const slots = resample5m(series(meal - 15 * MIN, values));
    const r = mealResponse(slots, { id: 'n1', ts: meal, carbsG: 50 }, 'UTC');
    expect(r).toMatchObject({
      noteId: 'n1',
      mealKind: 'breakfast',
      carbsG: 50,
      preMgdl: 100,
      at1hMgdl: 180,
      at2hMgdl: 140,
      peakMgdl: 180,
      minutesToPeak: 60,
    });
  });

  it('veri yoksa null alanlar ve ortalamalar', () => {
    const res = mealAnalysis([], [{ id: 'a', ts: T0 + 13 * 60 * MIN, carbsG: null }], 'UTC');
    expect(res.responses[0]).toMatchObject({
      preMgdl: null,
      at1hMgdl: null,
      peakMgdl: null,
      minutesToPeak: null,
    });
    expect(res.averages).toEqual([
      {
        mealKind: 'lunch',
        count: 1,
        preMgdl: null,
        at1hMgdl: null,
        at2hMgdl: null,
        peakMgdl: null,
        minutesToPeak: null,
      },
    ]);
  });
});
