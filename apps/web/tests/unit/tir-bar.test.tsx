import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TirStackedBar } from '../../src/components/charts/TirStackedBar';

const s = (percent: number) => ({ percent, minutesPerDay: Math.round((percent / 100) * 1440) });
const tir = { veryLow: s(1), low: s(3), inRange: s(72), high: s(18), veryHigh: s(6) };

describe('TirStackedBar', () => {
  it('yatay: erişilebilir özet ve etiketli yüzdeler', () => {
    render(<TirStackedBar tir={tir} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Hedefte %72');
    expect(screen.getByText('Çok yüksek')).toBeInTheDocument();
  });
  it('dikey: hedef ✓/✗ metinle gösterilir', () => {
    render(
      <TirStackedBar
        tir={tir}
        variant="vertical"
        goals={{ inRange: { ok: true, text: '> %70' }, veryHigh: { ok: false, text: '< %5' } }}
      />,
    );
    expect(screen.getByText(/Hedef karşılandı/)).toBeInTheDocument();
    expect(screen.getByText(/Hedef karşılanmadı/)).toBeInTheDocument();
    expect(screen.getByText('14 dk/gün')).toBeInTheDocument();
    expect(screen.getByText('1 sa 26 dk/gün')).toBeInTheDocument();
  });
});
