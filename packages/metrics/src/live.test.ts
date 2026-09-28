import { describe, expect, it } from 'vitest';
import { liveDelta } from './live.js';
import { MIN, T0 } from './test-helpers.js';

describe('liveDelta', () => {
  it('~5 dk önceki değere göre fark', () => {
    const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ ts: T0 + i * MIN, mgdl: 100 + i * 2 }));
    expect(liveDelta(pts)).toBe(10);
  });
  it('yeterli geçmiş yoksa null', () => {
    expect(liveDelta([{ ts: T0, mgdl: 100 }])).toBeNull();
    expect(
      liveDelta([
        { ts: T0, mgdl: 100 },
        { ts: T0 + 20 * MIN, mgdl: 120 },
      ]),
    ).toBeNull();
  });
  it('en yakın aday seçilir, sıralı olmayan girdi', () => {
    const pts = [
      { ts: T0 + 10 * MIN, mgdl: 130 },
      { ts: T0 + 4 * MIN, mgdl: 110 },
      { ts: T0 + 6 * MIN, mgdl: 120 },
    ];
    expect(liveDelta(pts)).toBe(20);
  });
});
