import { useMemo } from 'react';
import type { GlucoseUnit } from '@glukoz/shared';
import { chartValue, unitLabel } from '../../lib/format';
import { EChart } from './EChart';
import { useChartPalette } from './palette';

interface Props {
  categories: string[];
  /** ortalama (mg/dL) — birime dönüştürülür */
  means: Array<number | null>;
  /** TIR yüzdesi */
  tir: Array<number | null>;
  unit: GlucoseUnit;
  meanLabel: string;
  tirLabel: string;
  label: string;
  summary: string;
}

/** Kategori bazlı ortalama (sol eksen) + TIR % (sağ eksen) karşılaştırma çubukları. */
export function ComparisonBars({
  categories,
  means,
  tir,
  unit,
  meanLabel,
  tirLabel,
  label,
  summary,
}: Props) {
  const p = useChartPalette();
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 44, top: 36, bottom: 28 },
      legend: { top: 0, textStyle: { color: p.text } },
      tooltip: { trigger: 'axis', confine: true },
      xAxis: { type: 'category', data: categories, axisLabel: { color: p.muted } },
      yAxis: [
        {
          type: 'value',
          name: unitLabel(unit),
          nameTextStyle: { color: p.muted },
          axisLabel: { color: p.muted },
          splitLine: { lineStyle: { color: p.border, opacity: 0.4 } },
        },
        {
          type: 'value',
          name: '%',
          min: 0,
          max: 100,
          nameTextStyle: { color: p.muted },
          axisLabel: { color: p.muted },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: meanLabel,
          type: 'bar',
          itemStyle: { color: p.muted },
          data: means.map((m) => chartValue(m, unit)),
          label: { show: true, position: 'top', color: p.text, fontSize: 10 },
        },
        {
          name: tirLabel,
          type: 'bar',
          yAxisIndex: 1,
          itemStyle: {
            color: p.inRange,
            decal: {
              symbol: 'rect',
              dashArrayX: [1, 0],
              dashArrayY: [2, 3],
              rotation: 0.8,
              color: 'rgba(255,255,255,0.35)',
            },
          },
          data: tir,
          label: { show: true, position: 'top', color: p.text, fontSize: 10, formatter: '%{c}' },
        },
      ],
    }),
    [categories, means, tir, unit, p, meanLabel, tirLabel],
  );
  return <EChart option={option} summary={summary} label={label} height={260} />;
}
