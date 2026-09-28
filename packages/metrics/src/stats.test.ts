import { describe, expect, it } from 'vitest';
import { mean, percentileSorted, round, sampleSd, sortedCopy } from './stats.js';

describe('stats', () => {
  it('mean / sd', () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4, 6])).toBe(4);
    expect(sampleSd([5])).toBeNull();
    expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });
  it('percentile tip 7', () => {
    const s = sortedCopy([4, 1, 3, 2, 5]);
    expect(s).toEqual([1, 2, 3, 4, 5]);
    expect(percentileSorted(s, 0.5)).toBe(3);
    expect(percentileSorted(s, 0.25)).toBe(2);
    expect(percentileSorted([1, 2], 0.5)).toBe(1.5);
    expect(percentileSorted([], 0.5)).toBeNull();
  });
  it('round', () => {
    expect(round(1.25, 1)).toBe(1.3);
    expect(round(null)).toBeNull();
    expect(round(Number.NaN)).toBeNull();
  });
});
