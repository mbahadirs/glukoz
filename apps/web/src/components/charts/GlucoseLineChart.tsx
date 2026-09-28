import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { withGapBreaks } from '@glukoz/metrics';
import {
  GLUCOSE_THRESHOLDS as T,
  type GlucosePoint,
  type GlucoseUnit,
  type GlycemicEvent,
  type NoteDto,
} from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { chartValue, fmtGlucose, unitLabel } from '../../lib/format';
import { EChart, type ChartClick } from './EChart';
import { overlayMaxTs, overlaySeries, type TrendOverlay } from './trendOverlays';
import { categoryLabel, entrySeries } from './entryMarkers';
import { categoryOf, ENTRY_CATEGORIES } from '../../lib/notes';
import { useChartPalette, type ChartPalette } from './palette';

export interface LineChartProps {
  points: Array<[number, number]>;
  unit: GlucoseUnit;
  tz: string;
  from: number;
  to: number;
  targetLow: number;
  targetHigh: number;
  notes?: NoteDto[];
  events?: GlycemicEvent[];
  /** Karşılaştırma eğrisi; `offsetMs` ile bu eksene kaydırılır */
  compare?: { points: Array<[number, number]>; offsetMs: number; label: string };
  height?: number;
  label: string;
  /** canlı grafik: öngörü ve nokta seçimi katmanları */
  overlay?: TrendOverlay;
  /** grafikte bir ölçüme dokunulunca (en yakın ölçüm) */
  onSelectPoint?: (point: GlucosePoint) => void;
}

/** Dokunma noktasına en yakın ölçüm (piksel mesafesi `maxPx` içinde). */
function nearestPoint(
  click: ChartClick,
  points: Array<[number, number]>,
  unit: GlucoseUnit,
  maxPx = 28,
): GlucosePoint | null {
  let best: [number, number] | null = null;
  for (const pt of points) {
    if (!best || Math.abs(pt[0] - click.data[0]) < Math.abs(best[0] - click.data[0])) best = pt;
  }
  if (!best) return null;
  const px = click.toPixel([best[0], chartValue(best[1], unit) as number]);
  if (!px || Math.hypot(px[0] - click.pixel[0], px[1] - click.pixel[1]) > maxPx) return null;
  return { ts: best[0], mgdl: best[1] };
}

function toSeries(points: Array<[number, number]>, unit: GlucoseUnit, offset = 0) {
  const slots = points.map(([ts, mgdl]) => ({ ts: ts + offset, mgdl }));
  return withGapBreaks(slots).map(([ts, v]) => [ts, chartValue(v, unit)]);
}

function pieces(p: ChartPalette, unit: GlucoseUnit) {
  const c = (v: number) => chartValue(v, unit) as number;
  return [
    { lt: c(T.VERY_LOW), color: p.veryLow },
    { gte: c(T.VERY_LOW), lt: c(T.LOW), color: p.low },
    { gte: c(T.LOW), lte: c(T.HIGH), color: p.inRange },
    { gt: c(T.HIGH), lte: c(T.VERY_HIGH), color: p.high },
    { gt: c(T.VERY_HIGH), color: p.veryHigh },
  ];
}

export function GlucoseLineChart(props: LineChartProps) {
  const { t, i18n } = useTranslation();
  const p = useChartPalette();
  const { unit, tz } = props;

  const option = useMemo(() => {
    const cv = (v: number) => chartValue(v, unit) as number;
    const yMax = cv(Math.max(300, ...props.points.map(([, v]) => v + 20)));
    const threshold = (v: number, color: string) => ({
      yAxis: cv(v),
      lineStyle: { color, type: 'dashed', width: 1 },
      label: {
        formatter: fmtGlucose(v, unit, i18n.language),
        color: p.muted,
        position: 'insideEndTop',
      },
    });
    // Lejant yalnızca girişler için: türler ayrı ayrı gizlenip gösterilebilir.
    const present = new Set((props.notes ?? []).map((n) => categoryOf(n.type)));
    const legendItems = ENTRY_CATEGORIES.filter((c) => present.has(c)).map((c) =>
      categoryLabel(c, t),
    );
    const eventAreas = (props.events ?? []).map((e) => [
      {
        xAxis: e.start,
        itemStyle: { color: e.kind === 'hyper' ? p.veryHigh : p.low, opacity: 0.12 },
        name: t(`events.kinds.${e.kind}`),
      },
      { xAxis: e.end },
    ]);
    return {
      grid: { left: 44, right: 16, top: legendItems.length ? 44 : 24, bottom: 32 },
      legend: legendItems.length
        ? {
            data: legendItems,
            top: 0,
            left: 0,
            itemWidth: 12,
            itemHeight: 12,
            textStyle: { color: p.muted, fontSize: 11 },
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        confine: true,
        triggerOn: 'mousemove|click',
        valueFormatter: (v: number | null) => (v === null ? '–' : `${v} ${unitLabel(unit)}`),
        axisPointer: {
          label: {
            formatter: (a: { value: number }) => dayjs(a.value).tz(tz).format('DD MMM HH:mm'),
          },
        },
      },
      xAxis: {
        type: 'time',
        min: props.from,
        max: Math.max(props.to, overlayMaxTs(props.overlay)),
        axisLabel: {
          color: p.muted,
          formatter: (v: number) => dayjs(v).tz(tz).format('HH:mm'),
          hideOverlap: true,
        },
        axisLine: { lineStyle: { color: p.border } },
        splitLine: { show: true, lineStyle: { color: p.border, opacity: 0.4 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax,
        name: unitLabel(unit),
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.border, opacity: 0.4 } },
      },
      visualMap: { show: false, seriesIndex: 0, dimension: 1, pieces: pieces(p, unit) },
      series: [
        {
          name: t('charts.glucose'),
          type: 'line',
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2 },
          data: toSeries(props.points, unit),
          markArea: {
            silent: true,
            data: [
              [
                { yAxis: cv(props.targetLow), itemStyle: { color: p.band } },
                { yAxis: cv(props.targetHigh) },
              ],
              ...eventAreas,
            ],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              threshold(T.VERY_LOW, p.veryLow),
              threshold(T.LOW, p.low),
              threshold(T.HIGH, p.high),
              threshold(T.VERY_HIGH, p.veryHigh),
            ],
          },
        },
        ...(props.compare
          ? [
              {
                name: props.compare.label,
                type: 'line',
                showSymbol: false,
                connectNulls: false,
                lineStyle: { width: 1.5, type: 'dashed', color: p.muted },
                itemStyle: { color: p.muted },
                data: toSeries(props.compare.points, unit, props.compare.offsetMs),
              },
            ]
          : []),
        ...entrySeries(props.notes, props.points, {
          unit,
          p,
          t,
          tz,
          laneMgdl: 45,
        }),
        ...overlaySeries(props.overlay, unit, p),
      ],
    };
  }, [props, p, unit, tz, t, i18n.language]);

  const summary = useMemo(() => {
    const vals = props.points.map(([, v]) => v);
    if (!vals.length) return t('charts.noData');
    return t('charts.lineSummary', {
      count: vals.length,
      min: fmtGlucose(Math.min(...vals), unit, i18n.language),
      max: fmtGlucose(Math.max(...vals), unit, i18n.language),
      unit: unitLabel(unit),
    });
  }, [props.points, unit, t, i18n.language]);

  const { onSelectPoint, points } = props;
  const onChartClick = useMemo(
    () =>
      onSelectPoint
        ? (click: ChartClick) => {
            const pt = nearestPoint(click, points, unit);
            if (pt) onSelectPoint(pt);
          }
        : undefined,
    [onSelectPoint, points, unit],
  );

  return (
    <EChart
      option={option}
      summary={summary}
      label={props.label}
      height={props.height ?? 300}
      onChartClick={onChartClick}
    />
  );
}
