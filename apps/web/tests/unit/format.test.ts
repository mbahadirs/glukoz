import { describe, expect, it } from 'vitest';
import { chartValue, fmtDelta, fmtGlucose, fmtMinutes, fmtPercent } from '../../src/lib/format';

const t = (k: string, o?: Record<string, unknown>) => `${k}:${JSON.stringify(o)}`;

describe('format', () => {
  it('birim dönüşümü ve Türkçe ondalık', () => {
    expect(fmtGlucose(180, 'mgdl')).toBe('180');
    expect(fmtGlucose(180, 'mmol')).toBe('10,0');
    expect(fmtGlucose(null, 'mgdl')).toBe('–');
    expect(fmtGlucose(99, 'mmol', 'en')).toBe('5.5');
  });
  it('delta işaretli', () => {
    expect(fmtDelta(4, 'mgdl')).toBe('+4');
    expect(fmtDelta(-9, 'mmol')).toBe('-0,5');
    expect(fmtDelta(0, 'mgdl')).toBe('0');
    expect(fmtDelta(null, 'mgdl')).toBe('–');
  });
  it('yüzde ve süre', () => {
    expect(fmtPercent(72.5)).toMatch(/%72,5/);
    expect(fmtMinutes(45, t)).toContain('units.minutes');
    expect(fmtMinutes(120, t)).toContain('units.hours');
    expect(fmtMinutes(85, t)).toContain('"h":1,"m":25');
  });
  it('grafik değeri', () => {
    expect(chartValue(null, 'mgdl')).toBeNull();
    expect(chartValue(100.4, 'mgdl')).toBe(100);
    expect(chartValue(100, 'mmol')).toBe(5.5);
  });
});
