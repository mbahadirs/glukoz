import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GLUCOSE_THRESHOLDS as T, type AgpBucket, type GlucoseUnit } from '@glukoz/shared';
import { chartValue, fmtGlucose, unitLabel } from '../../lib/format';
import { EChart } from './EChart';
import { useChartPalette } from './palette';

interface Props {
  agp: AgpBucket[];
  unit: GlucoseUnit;
  targetLow: number;
  targetHigh: number;
  height?: number;
}

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** AGP: %5–95 açık bant, %25–75 koyu bant, medyan kalın çizgi (SPEC 8.6). */
export function AgpChart({ agp, unit, targetLow, targetHigh, height = 320 }: Props) {
  const { t, i18n } = useTranslation();
  const p = useChartPalette();

  const option = useMemo(() => {
    const cv = (v: number | null) => chartValue(v, unit);
    const diff = (a: number | null, b: number | null) =>
      a === null || b === null ? null : (cv(a) as number) - (cv(b) as number);
    const stackSeries = (
      name: string,
      stack: string,
      base: (b: AgpBucket) => number | null,
      top: (b: AgpBucket) => number | null,
      opacity: number,
    ) => [
      {
        name: `${name}-base`,
        type: 'line',
        stack,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
        data: agp.map((b) => cv(base(b))),
      },
      {
        name,
        type: 'line',
        stack,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: p.accent, opacity },
        tooltip: { show: false },
        data: agp.map((b) => diff(top(b), base(b))),
      },
    ];
    const cvv = (v: number) => cv(v) as number;
    return {
      grid: { left: 44, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (items: Array<{ dataIndex: number }>) => {
          const b = agp[items[0]?.dataIndex ?? 0];
          if (!b || b.p50 === null) return t('charts.noData');
          const f = (v: number | null) => fmtGlucose(v ?? Number.NaN, unit, i18n.language);
          return `${hhmm(b.minuteOfDay)}<br/>%95: ${f(b.p95)}<br/>%75: ${f(b.p75)}<br/><b>%50: ${f(b.p50)}</b><br/>%25: ${f(b.p25)}<br/>%5: ${f(b.p5)}`;
        },
      },
      // Bantlar yığılmış alanlarla çizilir; ECharts yığmayı yalnızca kategori ekseninde
      // güvenilir yapar → 96 × 15 dk kova kategori olarak, etiket 3 saatte bir.
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: agp.map((b) => hhmm(b.minuteOfDay)),
        axisLabel: { color: p.muted, interval: 11 },
        axisTick: { interval: 11 },
        splitLine: { show: true, interval: 11, lineStyle: { color: p.border, opacity: 0.4 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: cvv(350),
        name: unitLabel(unit),
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.border, opacity: 0.4 } },
      },
      series: [
        ...stackSeries(
          'p5-95',
          'outer',
          (b) => b.p5,
          (b) => b.p95,
          0.18,
        ),
        ...stackSeries(
          'p25-75',
          'inner',
          (b) => b.p25,
          (b) => b.p75,
          0.4,
        ),
        {
          name: t('reports.agp.median'),
          type: 'line',
          symbol: 'none',
          lineStyle: { width: 3, color: p.accent },
          data: agp.map((b) => cv(b.p50)),
          markArea: {
            silent: true,
            data: [
              [{ yAxis: cvv(targetLow), itemStyle: { color: p.band } }, { yAxis: cvv(targetHigh) }],
            ],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: cvv(T.LOW),
                lineStyle: { color: p.low, type: 'solid' },
                label: { formatter: fmtGlucose(T.LOW, unit, i18n.language), color: p.muted },
              },
              {
                yAxis: cvv(T.HIGH),
                lineStyle: { color: p.high, type: 'solid' },
                label: { formatter: fmtGlucose(T.HIGH, unit, i18n.language), color: p.muted },
              },
            ],
          },
        },
      ],
    };
  }, [agp, unit, p, targetLow, targetHigh, t, i18n.language]);

  const summary = useMemo(() => {
    const med = agp.filter((b) => b.p50 !== null);
    if (!med.length) return t('charts.noData');
    const lo = med.reduce((a, b) => ((b.p50 as number) < (a.p50 as number) ? b : a));
    const hi = med.reduce((a, b) => ((b.p50 as number) > (a.p50 as number) ? b : a));
    return t('charts.agpSummary', {
      lowTime: hhmm(lo.minuteOfDay),
      low: fmtGlucose(lo.p50 as number, unit, i18n.language),
      highTime: hhmm(hi.minuteOfDay),
      high: fmtGlucose(hi.p50 as number, unit, i18n.language),
      unit: unitLabel(unit),
    });
  }, [agp, unit, t, i18n.language]);

  return (
    <EChart option={option} summary={summary} label={t('reports.agp.title')} height={height} />
  );
}
