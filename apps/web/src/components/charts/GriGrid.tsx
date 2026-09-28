import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GriResult } from '@glukoz/shared';
import { fmtNumber } from '../../lib/format';
import { EChart } from './EChart';
import { useChartPalette } from './palette';

const X_MAX = 30;
const Y_MAX = 60;
const ZONES = [20, 40, 60, 80] as const;

/** GRI ızgarası: x = hipo bileşeni, y = hiper bileşeni; bölge sınırları 3x + 1,6y = k. */
export function GriGrid({ gri }: { gri: GriResult }) {
  const { t, i18n } = useTranslation();
  const p = useChartPalette();
  const option = useMemo(() => {
    const boundary = (k: number) => [
      { coord: [0, Math.min(Y_MAX, k / 1.6)] },
      { coord: [Math.min(X_MAX, k / 3), k / 1.6 > Y_MAX ? (k - 3 * X_MAX) / 1.6 : 0] },
    ];
    return {
      grid: { left: 48, right: 16, top: 16, bottom: 40 },
      tooltip: { formatter: () => `GRI ${fmtNumber(gri.gri, 1, i18n.language)} (${gri.zone})` },
      xAxis: {
        type: 'value',
        min: 0,
        max: X_MAX,
        name: t('reports.gri.hypo'),
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.border, opacity: 0.4 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: Y_MAX,
        name: t('reports.gri.hyper'),
        nameLocation: 'middle',
        nameGap: 32,
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.border, opacity: 0.4 } },
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 14,
          itemStyle: { color: p.accent, borderColor: p.text, borderWidth: 1 },
          data: [[Math.min(gri.hypoComponent, X_MAX), Math.min(gri.hyperComponent, Y_MAX)]],
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: p.muted, type: 'dashed' },
            label: { show: false },
            data: ZONES.map(boundary),
          },
        },
      ],
      graphic: [],
    };
  }, [gri, p, t, i18n.language]);
  return (
    <div>
      <EChart
        option={option}
        summary={t('reports.gri.summary', {
          gri: fmtNumber(gri.gri, 1, i18n.language),
          zone: gri.zone,
        })}
        label={t('reports.gri.title')}
        height={260}
      />
      <p className="mt-1 text-xs text-muted">{t('reports.gri.zones')}</p>
    </div>
  );
}
