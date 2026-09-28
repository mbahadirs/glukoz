import { describe, expect, it } from 'vitest';
import { glycemiaRiskIndex, griZone, riskIndices } from './risk.js';
import { T0 } from './test-helpers.js';

const s = (percent: number) => ({ percent, minutesPerDay: 0 });

describe('GRI', () => {
  it('bilinen girdi', () => {
    // hypo = 1 + 0.8*3 = 3.4 ; hyper = 5 + 0.5*20 = 15 ; GRI = 10.2 + 24 = 34.2
    const r = glycemiaRiskIndex({ veryLow: s(1), low: s(3), high: s(20), veryHigh: s(5) });
    expect(r).toEqual({ gri: 34.2, hypoComponent: 3.4, hyperComponent: 15, zone: 'B' });
  });
  it('100 ile sınırlanır', () => {
    expect(glycemiaRiskIndex({ veryLow: s(50), low: s(0), high: s(0), veryHigh: s(50) }).gri).toBe(
      100,
    );
  });
  it('bölgeler', () => {
    expect([0, 20, 20.1, 40, 50, 70, 90].map(griZone)).toEqual(['A', 'A', 'B', 'B', 'C', 'D', 'E']);
  });
});

describe('LBGI/HBGI', () => {
  it('boş', () => expect(riskIndices([])).toEqual({ lbgi: null, hbgi: null }));
  it('düşük değer sadece LBGI, yüksek değer sadece HBGI', () => {
    const f = (g: number) => 1.509 * (Math.log(g) ** 1.084 - 5.381);
    const low = riskIndices([{ ts: T0, mgdl: 50 }]);
    expect(low.hbgi).toBe(0);
    expect(low.lbgi).toBeCloseTo(10 * f(50) ** 2, 2);
    const high = riskIndices([{ ts: T0, mgdl: 300 }]);
    expect(high.lbgi).toBe(0);
    expect(high.hbgi).toBeCloseTo(10 * f(300) ** 2, 2);
    // 112.5 civarında f ≈ 0
    expect(riskIndices([{ ts: T0, mgdl: 112.5 }]).lbgi).toBeLessThan(0.01);
  });
});
