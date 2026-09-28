import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_RULES, type AlertRuleConfig } from '../src/alerts/defaults.js';
import { evaluateRule, inCooldown, isQuietTime, type EvalReading } from '../src/alerts/evaluate.js';

const MIN = 60_000;
const NOW = Date.UTC(2026, 8, 27, 12, 0);
const rule = (kind: string, patch: Partial<AlertRuleConfig> = {}): AlertRuleConfig => ({
  ...(DEFAULT_ALERT_RULES.find((r) => r.kind === kind) as AlertRuleConfig),
  ...patch,
});
/** Her dakika bir okuma, sonuncusu `NOW - lastAgeMin`. */
const series = (values: number[], lastAgeMin = 0, trend: number | null = 3): EvalReading[] =>
  values.map((mgdl, i) => ({ ts: NOW - (lastAgeMin + values.length - 1 - i) * MIN, mgdl, trend }));

describe('evaluateRule', () => {
  it('urgent_low anında', () => {
    expect(
      evaluateRule(rule('urgent_low'), { now: NOW, readings: series([60, 52]), sensorEnd: null }),
    ).toMatchObject({
      active: true,
      mgdl: 52,
    });
    expect(
      evaluateRule(rule('urgent_low'), { now: NOW, readings: series([60, 55]), sensorEnd: null })
        .active,
    ).toBe(false);
  });

  it('low ≥ 10 dk sürmeli', () => {
    const r = rule('low');
    expect(
      evaluateRule(r, { now: NOW, readings: series(Array(10).fill(65)), sensorEnd: null }).active,
    ).toBe(false); // 9 dk
    expect(
      evaluateRule(r, { now: NOW, readings: series(Array(11).fill(65)), sensorEnd: null }).active,
    ).toBe(true);
    expect(
      evaluateRule(r, {
        now: NOW,
        readings: series([...Array(10).fill(65), 75, 65]),
        sensorEnd: null,
      }).active,
    ).toBe(false);
  });

  it('eski veriyle değer uyarısı üretilmez', () => {
    expect(
      evaluateRule(rule('urgent_low'), { now: NOW, readings: series([40], 25), sensorEnd: null })
        .active,
    ).toBe(false);
    expect(
      evaluateRule(rule('urgent_low'), { now: NOW, readings: [], sensorEnd: null }).active,
    ).toBe(false);
  });

  it('high > 250, 30 dk', () => {
    expect(
      evaluateRule(rule('high'), {
        now: NOW,
        readings: series(Array(31).fill(260)),
        sensorEnd: null,
      }),
    ).toMatchObject({ active: true, mgdl: 260 });
    expect(
      evaluateRule(rule('high'), {
        now: NOW,
        readings: series(Array(31).fill(250)),
        sensorEnd: null,
      }).active,
    ).toBe(false);
  });

  it('rapid_fall: ok 1 ve < 120; rapid_rise varsayılan kapalı', () => {
    expect(
      evaluateRule(rule('rapid_fall'), {
        now: NOW,
        readings: series([130, 110], 0, 1),
        sensorEnd: null,
      }).active,
    ).toBe(true);
    expect(
      evaluateRule(rule('rapid_fall'), {
        now: NOW,
        readings: series([130, 125], 0, 1),
        sensorEnd: null,
      }).active,
    ).toBe(false);
    expect(
      evaluateRule(rule('rapid_rise'), { now: NOW, readings: series([200], 0, 5), sensorEnd: null })
        .active,
    ).toBe(false);
    expect(
      evaluateRule(rule('rapid_rise', { enabled: true }), {
        now: NOW,
        readings: series([200], 0, 5),
        sensorEnd: null,
      }).active,
    ).toBe(true);
  });

  it('stale > 20 dk', () => {
    expect(
      evaluateRule(rule('stale'), { now: NOW, readings: series([100], 21), sensorEnd: null }),
    ).toMatchObject({ active: true, mgdl: null });
    expect(
      evaluateRule(rule('stale'), { now: NOW, readings: series([100], 19), sensorEnd: null })
        .active,
    ).toBe(false);
    expect(evaluateRule(rule('stale'), { now: NOW, readings: [], sensorEnd: null }).active).toBe(
      false,
    );
  });

  it('sensor_ending < 24 saat', () => {
    expect(
      evaluateRule(rule('sensor_ending'), { now: NOW, readings: [], sensorEnd: NOW + 5 * 3600_000 })
        .message,
    ).toContain('5 saat');
    expect(
      evaluateRule(rule('sensor_ending'), {
        now: NOW,
        readings: [],
        sensorEnd: NOW + 30 * 3600_000,
      }).active,
    ).toBe(false);
    expect(
      evaluateRule(rule('sensor_ending'), { now: NOW, readings: [], sensorEnd: NOW - 1 }).active,
    ).toBe(false);
    expect(
      evaluateRule(rule('sensor_ending'), { now: NOW, readings: [], sensorEnd: null }).active,
    ).toBe(false);
  });

  it('kapalı kural', () => {
    expect(
      evaluateRule(rule('urgent_low', { enabled: false }), {
        now: NOW,
        readings: series([40]),
        sensorEnd: null,
      }).active,
    ).toBe(false);
  });
});

describe('sessiz saatler ve cooldown', () => {
  const quiet = { quietStart: '23:00', quietEnd: '07:00' };
  it('gece yarısını kesen aralık (İstanbul)', () => {
    const at = (h: number) => Date.UTC(2026, 8, 27, h - 3, 0);
    expect(isQuietTime(rule('low', quiet), at(23), 'Europe/Istanbul')).toBe(true);
    expect(isQuietTime(rule('low', quiet), at(3), 'Europe/Istanbul')).toBe(true);
    expect(isQuietTime(rule('low', quiet), at(7), 'Europe/Istanbul')).toBe(false);
    expect(isQuietTime(rule('low', quiet), at(12), 'Europe/Istanbul')).toBe(false);
  });
  it('urgent_low sessiz saatlerden etkilenmez', () => {
    expect(
      isQuietTime(rule('urgent_low', quiet), Date.UTC(2026, 8, 27, 0), 'Europe/Istanbul'),
    ).toBe(false);
  });
  it('gün içi aralık ve eşit uçlar', () => {
    const r = rule('high', { quietStart: '13:00', quietEnd: '14:00' });
    expect(isQuietTime(r, Date.UTC(2026, 8, 27, 13, 30), 'UTC')).toBe(true);
    expect(isQuietTime(rule('high', { quietStart: '13:00', quietEnd: '13:00' }), NOW, 'UTC')).toBe(
      false,
    );
    expect(isQuietTime(rule('high'), NOW, 'UTC')).toBe(false);
  });
  it('cooldown', () => {
    expect(inCooldown(null, rule('low'), NOW)).toBe(false);
    expect(inCooldown(NOW - 29 * MIN, rule('low'), NOW)).toBe(true);
    expect(inCooldown(NOW - 30 * MIN, rule('low'), NOW)).toBe(false);
  });
});
