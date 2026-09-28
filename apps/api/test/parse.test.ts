import { describe, expect, it } from 'vitest';
import {
  normalizeTrend,
  parseFactoryTimestamp,
  parseMeasurement,
  sensorExpectedEnd,
  trendCode,
} from '../src/llu/parse.js';

describe('parseFactoryTimestamp', () => {
  it.each([
    ['5/21/2022 1:38:50 PM', Date.UTC(2022, 4, 21, 13, 38, 50)],
    ['12/1/2025 9:05:07 AM', Date.UTC(2025, 11, 1, 9, 5, 7)],
    ['1/31/2026 11:59:59 PM', Date.UTC(2026, 0, 31, 23, 59, 59)],
    ['10/10/2026 12:00:00 AM', Date.UTC(2026, 9, 10, 0, 0, 0)], // gece yarısı
    ['10/10/2026 12:30:00 PM', Date.UTC(2026, 9, 10, 12, 30, 0)], // öğle
    ['03/04/2026 01:02:03 AM', Date.UTC(2026, 2, 4, 1, 2, 3)], // çift haneli
    ['3/04/2026 1:02:03 PM', Date.UTC(2026, 2, 4, 13, 2, 3)], // karışık
  ])('%s', (input, expected) => expect(parseFactoryTimestamp(input)).toBe(expected));

  it('geçersiz biçimler', () => {
    expect(parseFactoryTimestamp('2026-01-01T00:00:00Z')).toBeNull();
    expect(parseFactoryTimestamp('13/1/2026 1:00:00 PM')).toBeNull();
    expect(parseFactoryTimestamp('')).toBeNull();
  });
});

describe('trend', () => {
  it('eşleme', () => {
    expect([0, 1, 2, 3, 4, 5, 9, null, undefined].map(trendCode)).toEqual([
      'NOT_COMPUTABLE',
      'SINGLE_DOWN',
      'FORTY_FIVE_DOWN',
      'FLAT',
      'FORTY_FIVE_UP',
      'SINGLE_UP',
      'NOT_COMPUTABLE',
      'NOT_COMPUTABLE',
      'NOT_COMPUTABLE',
    ]);
    expect([0, 1, 5, 6, null].map(normalizeTrend)).toEqual([null, 1, 5, null, null]);
  });
});

describe('parseMeasurement', () => {
  it('ValueInMgPerDl kullanılır; Value ve renk yok sayılır', () => {
    const r = parseMeasurement({
      FactoryTimestamp: '5/21/2022 1:38:50 PM',
      Timestamp: '5/21/2022 4:38:50 PM',
      ValueInMgPerDl: 91.4,
      Value: 5.1,
      TrendArrow: 3,
      MeasurementColor: 3,
    });
    expect(r).toEqual({
      ts: new Date(Date.UTC(2022, 4, 21, 13, 38, 50)),
      mgdl: 91,
      trend: 3,
      deviceLocalTs: '5/21/2022 4:38:50 PM',
    });
  });
  it('geçersiz değer/zaman', () => {
    expect(parseMeasurement({ FactoryTimestamp: 'x', ValueInMgPerDl: 90 })).toBeNull();
    expect(
      parseMeasurement({ FactoryTimestamp: '5/21/2022 1:38:50 PM', ValueInMgPerDl: 0 }),
    ).toBeNull();
  });
  it('sensör bitişi', () => {
    expect(sensorExpectedEnd(1_000_000, 15).getTime()).toBe(1_000_000_000 + 15 * 86_400_000);
  });
});

describe('parseFactoryTimestamp uç durumlar', () => {
  it('taşan tarih ve saat reddedilir', () => {
    expect(parseFactoryTimestamp('2/31/2026 1:00:00 PM')).toBeNull();
    expect(parseFactoryTimestamp('2/1/2026 13:00:00 PM')).toBeNull();
    expect(parseFactoryTimestamp('2/1/2026 0:00:00 AM')).toBeNull();
    expect(parseFactoryTimestamp('2/1/2026 1:60:00 AM')).toBeNull();
    expect(parseFactoryTimestamp('2/1/2026 1:00:00 pm')).toBe(Date.UTC(2026, 1, 1, 13));
  });
});
