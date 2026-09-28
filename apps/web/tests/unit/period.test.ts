import { describe, expect, it } from 'vitest';
import { resolvePeriod } from '../../src/routes/reports/period';

const NOW = Date.UTC(2026, 8, 27, 10, 7);

describe('resolvePeriod', () => {
  it('varsayılan 14 gün, 15 dk yuvarlama', () => {
    const p = resolvePeriod({}, 'Europe/Istanbul', NOW);
    expect(p.days).toBe(14);
    expect(p.to).toBe(Date.UTC(2026, 8, 27, 10, 15));
    expect(p.to - p.from).toBe(14 * 86_400_000);
    expect(p.custom).toBe(false);
  });
  it('geçersiz gün sayısı varsayılana düşer', () => {
    expect(resolvePeriod({ days: 13 }, 'UTC', NOW).days).toBe(14);
    expect(resolvePeriod({ days: 90 }, 'UTC', NOW).days).toBe(90);
  });
  it('özel aralık hasta saat diliminde, bitiş günü dahil', () => {
    const p = resolvePeriod({ from: '2026-09-01', to: '2026-09-07' }, 'Europe/Istanbul', NOW);
    expect(p.custom).toBe(true);
    expect(p.from).toBe(Date.UTC(2026, 7, 31, 21));
    expect(p.to).toBe(Date.UTC(2026, 8, 7, 21));
    expect(p.days).toBe(7);
  });
  it('ters özel aralık yok sayılır', () => {
    expect(resolvePeriod({ from: '2026-09-07', to: '2026-09-01' }, 'UTC', NOW).custom).toBe(false);
  });
});
