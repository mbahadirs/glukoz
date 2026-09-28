import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKey,
  datesInRange,
  minuteOfDay,
  tzOffsetMs,
  zonedDayStart,
  zonedParts,
} from './time.js';

describe('time', () => {
  it('Europe/Istanbul UTC+3', () => {
    const ts = Date.UTC(2026, 0, 5, 22, 30);
    expect(dateKey(ts, 'Europe/Istanbul')).toBe('2026-01-06');
    expect(minuteOfDay(ts, 'Europe/Istanbul')).toBe(90);
    expect(tzOffsetMs(ts, 'Europe/Istanbul')).toBe(3 * 3600_000);
    expect(zonedParts(ts, 'Europe/Istanbul').weekday).toBe(2);
  });
  it('gece yarısı h23 ile 0 olur', () => {
    expect(zonedParts(Date.UTC(2026, 0, 5, 0, 0), 'UTC').hour).toBe(0);
  });
  it('zonedDayStart farklı saat dilimleri', () => {
    expect(zonedDayStart('2026-01-06', 'Europe/Istanbul')).toBe(Date.UTC(2026, 0, 5, 21, 0));
    expect(zonedDayStart('2026-01-06', 'America/New_York')).toBe(Date.UTC(2026, 0, 6, 5, 0));
    // DST günü: New York 2026-03-08 → gün başlangıcı hâlâ EST (UTC−5)
    expect(zonedDayStart('2026-03-08', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 5, 0));
    expect(zonedDayStart('2026-03-09', 'America/New_York')).toBe(Date.UTC(2026, 2, 9, 4, 0));
  });
  it('addDays ay/yıl geçişi', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('datesInRange', () => {
    const from = zonedDayStart('2026-01-05', 'Europe/Istanbul');
    const to = zonedDayStart('2026-01-08', 'Europe/Istanbul');
    expect(datesInRange(from, to, 'Europe/Istanbul')).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
    ]);
    expect(datesInRange(to, from, 'UTC')).toEqual([]);
  });
});
