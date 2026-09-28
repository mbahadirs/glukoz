import { describe, expect, it } from 'vitest';
import { classifyGlucose, convertGlucose, formatGlucose, mgdlToMmol, mmolToMgdl } from './index.js';

describe('units', () => {
  it('mg/dL → mmol/L bir ondalık', () => {
    expect(mgdlToMmol(180)).toBe(10);
    expect(mgdlToMmol(70)).toBe(3.9);
    expect(mmolToMgdl(10)).toBe(180);
  });
  it('Türkçe biçim virgül kullanır', () => {
    expect(formatGlucose(70, 'mmol')).toBe('3,9');
    expect(formatGlucose(123.4, 'mgdl')).toBe('123');
    expect(convertGlucose(99.6, 'mgdl')).toBe(100);
  });
});

describe('classifyGlucose', () => {
  it.each([
    [53, 'veryLow'],
    [54, 'low'],
    [69, 'low'],
    [70, 'inRange'],
    [180, 'inRange'],
    [181, 'high'],
    [250, 'high'],
    [251, 'veryHigh'],
  ] as const)('%i → %s', (v, c) => expect(classifyGlucose(v)).toBe(c));
});

import { rangeQuery, patientUpdate } from './schemas.js';

describe('schemas', () => {
  it('rangeQuery ms ve ISO kabul eder, ters aralığı reddeder', () => {
    const r = rangeQuery.parse({ from: '1767571200000', to: '2026-01-06T00:00:00Z' });
    expect(r.from.getTime()).toBe(1767571200000);
    expect(rangeQuery.safeParse({ from: '2026-01-06', to: '2026-01-05' }).success).toBe(false);
    expect(rangeQuery.safeParse({ from: 'abc', to: '2026-01-05' }).success).toBe(false);
  });
  it('patientUpdate hedef sırası', () => {
    expect(patientUpdate.safeParse({ targetLow: 100, targetHigh: 150 }).success).toBe(true);
    expect(patientUpdate.safeParse({ targetLow: 110, targetHigh: 120 }).success).toBe(true);
    expect(patientUpdate.safeParse({ targetLow: 120, targetHigh: 120 }).success).toBe(false);
  });
});
