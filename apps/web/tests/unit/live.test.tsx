import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentResponse } from '@glukoz/shared';
import { ageClass, CurrentValue, remainingText, StaleStrip } from '../../src/routes/live/parts';
import { applyReading } from '../../src/hooks/useStream';

const NOW = Date.UTC(2026, 8, 27, 10, 0);
const base: CurrentResponse = {
  patientId: 'p1',
  reading: { ts: new Date(NOW - 120_000).toISOString(), mgdl: 65, trend: 2 },
  delta: -6,
  ageSec: 120,
  sensor: null,
  today: { tir: null, mean: null, hypoCount: 0, min: null, max: null },
  lastFetchAt: null,
};

describe('canlı ekran', () => {
  it('yaş sınıfı', () => {
    expect(ageClass(60)).toBe('ok');
    expect(ageClass(6 * 60)).toBe('warn');
    expect(ageClass(16 * 60)).toBe('stale');
    expect(ageClass(null)).toBe('stale');
  });

  it('değer, aralık etiketi, trend ve delta gösterilir', () => {
    render(<CurrentValue data={base} unit="mgdl" now={NOW} />);
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('Düşük')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Düşüyor' })).toHaveTextContent('↘');
    expect(screen.getByText('-6 mg/dL / 5 dk')).toBeInTheDocument();
  });

  it('mmol/L gösterimi', () => {
    render(<CurrentValue data={base} unit="mmol" now={NOW} />);
    expect(screen.getByText('3,6')).toBeInTheDocument();
  });

  it('gecikme şeridi yalnız 15 dk üstünde', () => {
    const { rerender } = render(<StaleStrip ageSec={600} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<StaleStrip ageSec={1000} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Veri gecikiyor');
  });

  it('sensör kalan süre metni', () => {
    const t = (k: string, o?: Record<string, unknown>) => `${k} ${JSON.stringify(o ?? {})}`;
    expect(remainingText(11 * 86_400 + 4 * 3600, t)).toBe('sensor.remaining {"days":11,"hours":4}');
    expect(remainingText(5 * 3600 + 120, t)).toContain('remainingHours');
    expect(remainingText(0, t)).toContain('expired');
  });

  it('SSE okuması current önbelleğini değiştirmeden yeni nesne üretir', () => {
    const ev = {
      type: 'reading' as const,
      patientId: 'p1',
      reading: { ts: new Date(NOW).toISOString(), mgdl: 70, trend: 3 },
    };
    const next = applyReading(base, ev);
    expect(next).not.toBe(base);
    expect(next?.reading?.mgdl).toBe(70);
    expect(base.reading?.mgdl).toBe(65);
    expect(
      applyReading(next, {
        ...ev,
        reading: { ...ev.reading, ts: new Date(NOW - 1e6).toISOString() },
      }),
    ).toBe(next);
    expect(applyReading(undefined, ev)).toBeUndefined();
  });
});
