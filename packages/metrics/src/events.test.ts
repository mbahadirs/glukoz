import { describe, expect, it } from 'vitest';
import { detectEvents, summarizeEvents } from './events.js';
import { resample5m } from './resample.js';
import { MIN, repeat, series, T0 } from './test-helpers.js';

const UTC = 'UTC';

describe('detectEvents', () => {
  it('< 15 dk düşüklük olay değildir', () => {
    const slots = resample5m(series(T0 + 12 * 60 * MIN, [100, 65, 65, 100, 100, 100, 100]));
    expect(detectEvents(slots, UTC)).toEqual([]);
  });

  it('hipo seviye 1: başlangıç, bitiş, nadir', () => {
    // 3 dilim (15 dk) < 70 → olay; 3 dilim ≥ 70 → biter
    const start = T0 + 12 * 60 * MIN;
    const slots = resample5m(series(start, [100, 68, 60, 66, 72, 75, 80, 90]));
    const ev = detectEvents(slots, UTC);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      kind: 'hypo_l1',
      start: start + 5 * MIN,
      end: start + 20 * MIN,
      durationMin: 15,
      extremeMgdl: 60,
      extremeTs: start + 10 * MIN,
      nocturnal: false,
      prolonged: false,
      ongoing: false,
    });
  });

  it('kısa toparlanma olayı bölmez', () => {
    const start = T0 + 12 * 60 * MIN;
    const slots = resample5m(series(start, [65, 65, 65, 75, 65, 65, 80, 80, 80]));
    const ev = detectEvents(slots, UTC).filter((e) => e.kind === 'hypo_l1');
    expect(ev).toHaveLength(1);
    expect(ev[0]?.durationMin).toBe(30);
  });

  it('seviye 2 ve uzamış hipo (≥120 dk), gece', () => {
    const start = T0 + 1 * 60 * MIN; // 01:00 UTC
    const slots = resample5m(series(start, [...repeat(50, 25), ...repeat(100, 3)]));
    const ev = detectEvents(slots, UTC);
    const l2 = ev.find((e) => e.kind === 'hypo_l2');
    expect(l2).toMatchObject({ durationMin: 125, prolonged: true, nocturnal: true });
    expect(ev.find((e) => e.kind === 'hypo_l1')).toBeDefined();
    const sum = summarizeEvents(ev);
    expect(sum).toMatchObject({
      hypoL1: 1,
      hypoL2: 1,
      nocturnalHypo: 1,
      prolongedHypo: 1,
      hyper: 0,
    });
  });

  it('hiper > 250, zirve ve uzamış', () => {
    const start = T0 + 14 * 60 * MIN;
    const slots = resample5m(
      series(start, [...repeat(260, 10), 320, ...repeat(260, 14), ...repeat(200, 3)]),
    );
    const ev = detectEvents(slots, UTC);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      kind: 'hyper',
      extremeMgdl: 320,
      durationMin: 125,
      prolonged: true,
    });
    expect(summarizeEvents(ev).prolongedHyper).toBe(1);
  });

  it('olay veri sonunda sürüyorsa ongoing', () => {
    const start = T0 + 12 * 60 * MIN;
    const ev = detectEvents(resample5m(series(start, [60, 60, 60, 60])), UTC);
    expect(ev[0]).toMatchObject({ ongoing: true, end: start + 20 * MIN });
  });

  it('uzun veri boşluğu olayı keser', () => {
    const start = T0 + 12 * 60 * MIN;
    const pts = [...series(start, [60, 60, 60, 60]), ...series(start + 90 * MIN, [60, 60])];
    const ev = detectEvents(resample5m(pts), UTC).filter((e) => e.kind === 'hypo_l1');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ end: start + 20 * MIN, ongoing: false });
  });

  it('gece yarısını kesen olay başlangıç saatine göre gece sayılır', () => {
    const start = Date.UTC(2026, 0, 5, 20, 45); // İstanbul 23:45
    const slots = resample5m(series(start, [...repeat(60, 6), ...repeat(90, 3)]));
    const ist = detectEvents(slots, 'Europe/Istanbul')[0];
    expect(ist?.nocturnal).toBe(false);
    const start2 = Date.UTC(2026, 0, 5, 21, 5); // İstanbul 00:05
    const ev2 = detectEvents(
      resample5m(series(start2, [...repeat(60, 6), ...repeat(90, 3)])),
      'Europe/Istanbul',
    );
    expect(ev2[0]?.nocturnal).toBe(true);
    // Aynı an New York saatinde 16:05 → gece değil
    const ny = detectEvents(
      resample5m(series(start2, [...repeat(60, 6), ...repeat(90, 3)])),
      'America/New_York',
    );
    expect(ny[0]?.nocturnal).toBe(false);
  });

  it('parametreler özelleştirilebilir', () => {
    const slots = resample5m(series(T0, [75, 75, 75, 100, 100, 100]));
    expect(detectEvents(slots, UTC, { hypoL1Threshold: 80 })).toHaveLength(1);
  });

  it('özet boş', () => {
    expect(summarizeEvents([])).toMatchObject({
      total: 0,
      avgHypoDurationMin: null,
      avgHyperDurationMin: null,
    });
  });
});
