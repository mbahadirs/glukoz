import { describe, expect, it } from 'vitest';
import { nextSelection } from '../../src/routes/live/useTrend';
import { fmtRate } from '../../src/lib/format';

const p = (ts: number, mgdl = 100) => ({ ts, mgdl });

describe('nextSelection', () => {
  it('en fazla 2 nokta; aynı nokta kaldırılır; 3. nokta yeni seçim başlatır', () => {
    expect(nextSelection([], p(1))).toEqual([p(1)]);
    expect(nextSelection([p(1)], p(2))).toEqual([p(1), p(2)]);
    expect(nextSelection([p(1), p(2)], p(2))).toEqual([p(1)]);
    expect(nextSelection([p(1), p(2)], p(3))).toEqual([p(3)]);
  });
});

describe('fmtRate', () => {
  it('işaretli, birime göre', () => {
    expect(fmtRate(1.25, 'mgdl')).toBe('+1,3');
    expect(fmtRate(-2, 'mgdl')).toBe('-2,0');
    expect(fmtRate(1.8, 'mmol')).toBe('+0,10');
    expect(fmtRate(0, 'mgdl')).toBe('0,0');
  });
});
