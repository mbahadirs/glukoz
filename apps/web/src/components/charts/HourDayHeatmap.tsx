import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GlucoseUnit, HeatmapCell } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { chartValue, fmtGlucose, unitLabel } from '../../lib/format';
import { EChart } from './EChart';
import { useChartPalette } from './palette';

interface Props {
  cells: HeatmapCell[];
  unit: GlucoseUnit;
}

type Mode = 'mean' | 'outOfRange';

export function HourDayHeatmap({ cells, unit }: Props) {
  const { t, i18n } = useTranslation();
  const p = useChartPalette();
  const [mode, setMode] = useState<Mode>('mean');
  const dates = useMemo(() => [...new Set(cells.map((c) => c.date))], [cells]);

  const option = useMemo(() => {
    const idx = new Map(dates.map((d, i) => [d, i]));
    const data = cells.map((c) => [
      c.hour,
      idx.get(c.date),
      mode === 'mean' ? chartValue(c.mean, unit) : c.count ? c.outOfRangeMin : null,
    ]);
    const cv = (v: number) => chartValue(v, unit) as number;
    const visualMap =
      mode === 'mean'
        ? {
            type: 'piecewise',
            show: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
            textStyle: { color: p.muted },
            pieces: [
              { lt: cv(54), color: p.veryLow, label: `< ${fmtGlucose(54, unit, i18n.language)}` },
              { gte: cv(54), lt: cv(70), color: p.low, label: t('ranges.low') },
              { gte: cv(70), lte: cv(180), color: p.inRange, label: t('ranges.inRange') },
              { gt: cv(180), lte: cv(250), color: p.high, label: t('ranges.high') },
              {
                gt: cv(250),
                color: p.veryHigh,
                label: `> ${fmtGlucose(250, unit, i18n.language)}`,
              },
            ],
          }
        : {
            type: 'continuous',
            min: 0,
            max: 60,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
            calculable: false,
            inRange: { color: [p.surface, p.veryHigh] },
            textStyle: { color: p.muted },
          };
    return {
      grid: { left: 64, right: 12, top: 8, bottom: 56 },
      tooltip: {
        confine: true,
        formatter: (x: { value: [number, number, number | null] }) => {
          const [h, di, v] = x.value;
          const date = dates[di] ?? '';
          const val =
            v === null
              ? '–'
              : mode === 'mean'
                ? `${v} ${unitLabel(unit)}`
                : t('units.minutes', { count: v });
          return `${dayjs(date).format('DD MMM')} ${String(h).padStart(2, '0')}:00 — ${val}`;
        },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
        axisLabel: { color: p.muted },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: dates.map((d) => dayjs(d).format('dd DD.MM')),
        axisLabel: { color: p.muted },
        inverse: true,
      },
      visualMap,
      series: [{ type: 'heatmap', data, itemStyle: { borderColor: p.bg, borderWidth: 1 } }],
    };
  }, [cells, dates, mode, unit, p, t, i18n.language]);

  return (
    <div>
      <div className="no-print mb-2 flex gap-2" role="group" aria-label={t('reports.heatmap.mode')}>
        {(['mean', 'outOfRange'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {t(`reports.heatmap.${m}`)}
          </button>
        ))}
      </div>
      <EChart
        option={option}
        summary={t('reports.heatmap.summary', { days: dates.length })}
        label={t('reports.heatmap.title')}
        height={Math.max(220, dates.length * 18 + 80)}
      />
    </div>
  );
}
