import { describe, expect, it } from 'vitest';
import { timeInRanges } from './ranges.js';
import { MIN, T0 } from './test-helpers.js';

const slotsOf = (values: number[]) => values.map((mgdl, i) => ({ ts: T0 + i * 5 * MIN, mgdl }));

describe('timeInRanges', () => {
  it('sınır değerleri doğru sınıflar', () => {
    // 53 veryLow, 54 low, 69 low, 70 in(tight), 140 in(tight), 180 in, 181 high, 250 high, 251 veryHigh, 100 in(tight)
    const r = timeInRanges(slotsOf([53, 54, 69, 70, 140, 180, 181, 250, 251, 100]));
    expect(r.veryLow.percent).toBe(10);
    expect(r.low.percent).toBe(20);
    expect(r.inRange.percent).toBe(40);
    expect(r.high.percent).toBe(20);
    expect(r.veryHigh.percent).toBe(10);
    expect(r.tightRange.percent).toBe(30);
    expect(r.low.minutesPerDay).toBe(288);
  });
  it('%4 ≈ 58 dk/gün', () => {
    const values = [...Array(96).fill(120), ...Array(4).fill(60)];
    expect(timeInRanges(slotsOf(values)).low).toEqual({ percent: 4, minutesPerDay: 58 });
  });
  it('hastaya özel hedef', () => {
    const r = timeInRanges(slotsOf([80, 150, 160]), 80, 150);
    expect(r.inTarget.percent).toBe(66.7);
  });
  it('boş ve tümü aralık dışı', () => {
    expect(timeInRanges([]).inRange).toEqual({ percent: 0, minutesPerDay: 0 });
    const r = timeInRanges(slotsOf([300, 320]));
    expect(r.veryHigh.percent).toBe(100);
    expect(r.inRange.percent).toBe(0);
  });
});
