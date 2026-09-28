import { describe, expect, it } from 'vitest';
import { agp, AGP_BUCKETS } from './agp.js';
import { MIN, T0 } from './test-helpers.js';

const DAY = 1440 * MIN;

describe('agp', () => {
  it('96 kova; < 5 değer kovada null', () => {
    const r = agp([{ ts: T0, mgdl: 100 }], 'UTC');
    expect(r).toHaveLength(AGP_BUCKETS);
    expect(r[0]).toMatchObject({ index: 0, minuteOfDay: 0, count: 1, p50: null });
  });

  it('yüzdelikler ve dairesel yumuşatma', () => {
    const slots = [];
    // Tüm kovalarda 5 gün boyunca aynı değerler: 100,110,120,130,140
    for (let d = 0; d < 5; d++)
      for (let b = 0; b < AGP_BUCKETS; b++)
        slots.push({ ts: T0 + d * DAY + b * 15 * MIN, mgdl: 100 + d * 10 });
    const r = agp(slots, 'UTC');
    expect(r[0]).toMatchObject({ count: 5, p5: 102, p25: 110, p50: 120, p75: 130, p95: 138 });
    expect(r[95]?.p50).toBe(120);
  });

  it('komşu boşsa yalnız dolu komşularla yumuşatır; saat dilimine göre kovalar', () => {
    const slots = [];
    for (let d = 0; d < 5; d++) {
      slots.push({ ts: T0 + d * DAY + 21 * 60 * MIN, mgdl: 100 }); // İstanbul 00:00 → kova 0
      slots.push({ ts: T0 + d * DAY + 21 * 60 * MIN + 15 * MIN, mgdl: 200 }); // kova 1
    }
    const r = agp(slots, 'Europe/Istanbul');
    expect(r[0]?.p50).toBe(150); // (100 + 200) / 2 ; kova 95 boş
    expect(r[1]?.p50).toBe(150);
    expect(r[2]?.p50).toBeNull();
  });
});
