import { describe, expect, it } from 'vitest';
import {
  extrapolate,
  linearProjection,
  medianIntervalMin,
  minHalfWidth,
  segmentTrend,
  tCritical,
} from './projection.js';
import { MIN, T0 } from './test-helpers.js';

const line = (n: number, start: number, slope: number, stepMin = 1) =>
  Array.from({ length: n }, (_, i) => ({
    ts: T0 + i * stepMin * MIN,
    mgdl: start + slope * i * stepMin,
  }));

describe('segmentTrend', () => {
  it('fark, süre ve eğim; ters sıra', () => {
    const a = { ts: T0, mgdl: 120 };
    const b = { ts: T0 + 30 * MIN, mgdl: 150 };
    expect(segmentTrend(b, a)).toEqual({
      from: a,
      to: b,
      deltaMgdl: 30,
      minutes: 30,
      ratePerMin: 1,
    });
    expect(segmentTrend(a, a)).toBeNull();
  });
  it('extrapolate 40–400 arasında sıkıştırır', () => {
    const r = extrapolate({ ts: T0, mgdl: 60 }, -2, 15);
    expect(r.map((p) => p.mgdl)).toEqual([50, 40, 40]);
    expect(r[2]?.ts).toBe(T0 + 15 * MIN);
  });
});

describe('linearProjection', () => {
  it('tam doğrusal veride eğimi bulur, aralık dardır', () => {
    const pts = line(21, 100, 1); // 20 dk, +1 mg/dL/dk
    const p = linearProjection(pts, { horizonMin: 30, stepMin: 15 });
    expect(p).not.toBeNull();
    expect(p?.slope).toBe(1);
    expect(p?.r2).toBe(1);
    expect(p?.residualSd).toBe(0);
    expect(p?.anchor.mgdl).toBe(120);
    // kalıntı 0 olsa da aralık alt sınırı uygulanır: 15 dk → ±9,25, 30 dk → ±14,5
    expect(p?.points).toEqual([
      { ts: T0 + 35 * MIN, mgdl: 135, lo: 126, hi: 144 },
      { ts: T0 + 50 * MIN, mgdl: 150, lo: 136, hi: 165 },
    ]);
    expect(p?.basedOn.count).toBe(21);
  });

  it('gürültülü veride aralık ufukla genişler', () => {
    const pts = line(21, 150, -1).map((p, i) => ({ ...p, mgdl: p.mgdl + (i % 2 ? 4 : -4) }));
    const p = linearProjection(pts);
    const widths = (p?.points ?? []).map((x) => x.hi - x.lo);
    expect(p?.slope).toBeCloseTo(-1, 0);
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0] as number);
  });

  it('yetersiz, kısa veya eski veride null', () => {
    expect(linearProjection([])).toBeNull();
    expect(linearProjection(line(2, 100, 1, 10))).toBeNull(); // 2 nokta
    expect(linearProjection(line(5, 100, 1))).toBeNull(); // 4 dk < 10 dk
    const pts = line(21, 100, 1);
    expect(linearProjection(pts, { now: T0 + 40 * MIN })).toBeNull(); // son ölçüm 20 dk eski
    expect(linearProjection(pts, { now: T0 + 25 * MIN })).not.toBeNull();
  });

  it('yalnızca pencere içindeki veriyi kullanır ve 40–400 sıkıştırır', () => {
    const old = line(30, 300, 0); // pencere dışında kalacak
    const recent = line(21, 80, -3).map((p) => ({ ...p, ts: p.ts + 60 * MIN }));
    const p = linearProjection([...old, ...recent]);
    expect(p?.basedOn.count).toBe(21);
    expect(p?.points.every((x) => x.mgdl >= 40 && x.lo >= 40)).toBe(true);
  });
});

describe('belirsizlik', () => {
  it('az veride t katsayısı büyüktür; alt sınır ufukla artar', () => {
    expect(tCritical(2)).toBe(4.3);
    expect(tCritical(7)).toBe(2.31);
    expect(tCritical(100)).toBe(1.96);
    expect(minHalfWidth(0)).toBe(4);
    expect(minHalfWidth(30)).toBeCloseTo(14.5);
  });
});

describe('medianIntervalMin', () => {
  it('dakikalık ve 15 dakikalık veri', () => {
    expect(medianIntervalMin(line(30, 100, 0))).toBe(1);
    expect(medianIntervalMin(line(8, 100, 0, 15), 120)).toBe(15);
    expect(
      medianIntervalMin([
        { ts: T0, mgdl: 1 },
        { ts: T0 + 2 * MIN, mgdl: 1 },
        { ts: T0 + 3 * MIN, mgdl: 1 },
        { ts: T0 + 6 * MIN, mgdl: 1 },
        { ts: T0 + 7 * MIN, mgdl: 1 },
      ]),
    ).toBe(1.5);
    expect(medianIntervalMin([{ ts: T0, mgdl: 1 }])).toBeNull();
    expect(
      medianIntervalMin(
        [
          { ts: T0, mgdl: 1 },
          { ts: T0 + 90 * MIN, mgdl: 1 },
        ],
        60,
      ),
    ).toBeNull();
  });
});
