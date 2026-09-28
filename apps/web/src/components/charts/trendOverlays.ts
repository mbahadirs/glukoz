import type { GlucosePoint, GlucoseUnit } from '@glukoz/shared';
import type { Projection } from '@glukoz/metrics';
import { chartValue } from '../../lib/format';
import type { ChartPalette } from './palette';

/** Canlı grafik katmanları: öngörü, kullanıcı seçimi ve iki nokta arası eğilim. */
export interface TrendOverlay {
  projection?: Projection | null;
  /** kullanıcının seçtiği en fazla 2 nokta */
  selection?: GlucosePoint[];
  /** seçimden ileri uzatılan eğilim (2 nokta seçiliyse) */
  selectionExtension?: GlucosePoint[];
  labels: { projection: string; selection: string; extension: string };
}

const NO_TOOLTIP = { show: false };

function projectionSeries(proj: Projection, unit: GlucoseUnit, p: ChartPalette, name: string) {
  const cv = (v: number) => chartValue(v, unit) as number;
  const band = [{ ts: proj.anchor.ts, lo: proj.anchor.mgdl, hi: proj.anchor.mgdl }, ...proj.points];
  return [
    {
      name: `${name}-lo`,
      type: 'line',
      stack: 'projection-band',
      silent: true,
      showSymbol: false,
      lineStyle: { opacity: 0 },
      tooltip: NO_TOOLTIP,
      data: band.map((b) => [b.ts, cv(b.lo)]),
    },
    {
      name: `${name}-band`,
      type: 'line',
      stack: 'projection-band',
      silent: true,
      showSymbol: false,
      lineStyle: { opacity: 0 },
      areaStyle: { color: p.accent, opacity: 0.12 },
      tooltip: NO_TOOLTIP,
      data: band.map((b) => [b.ts, cv(b.hi) - cv(b.lo)]),
    },
    {
      name,
      type: 'line',
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { type: 'dashed', width: 2, color: p.accent },
      itemStyle: { color: p.accent },
      data: [proj.anchor, ...proj.points].map((x) => [x.ts, cv(x.mgdl)]),
    },
  ];
}

function selectionSeries(o: TrendOverlay, unit: GlucoseUnit, p: ChartPalette) {
  const sel = o.selection ?? [];
  if (sel.length === 0) return [];
  const cv = (v: number) => chartValue(v, unit) as number;
  const sorted = [...sel].sort((a, b) => a.ts - b.ts);
  const series: unknown[] = [
    {
      name: o.labels.selection,
      type: 'line',
      symbol: 'circle',
      symbolSize: 12,
      showSymbol: true,
      lineStyle: { width: sorted.length > 1 ? 3 : 0, color: p.text },
      itemStyle: { color: p.bg, borderColor: p.text, borderWidth: 3 },
      label: {
        show: true,
        position: 'top',
        color: p.text,
        fontWeight: 'bold',
        formatter: (x: { dataIndex: number }) => String(x.dataIndex + 1),
      },
      z: 10,
      data: sorted.map((x) => [x.ts, cv(x.mgdl)]),
    },
  ];
  const ext = o.selectionExtension ?? [];
  const last = sorted[sorted.length - 1] as GlucosePoint;
  if (sorted.length > 1 && ext.length) {
    series.push({
      name: o.labels.extension,
      type: 'line',
      showSymbol: false,
      lineStyle: { type: 'dotted', width: 2, color: p.text },
      z: 9,
      data: [last, ...ext].map((x) => [x.ts, cv(x.mgdl)]),
    });
  }
  return series;
}

export function overlaySeries(
  o: TrendOverlay | undefined,
  unit: GlucoseUnit,
  p: ChartPalette,
): unknown[] {
  if (!o) return [];
  return [
    ...(o.projection ? projectionSeries(o.projection, unit, p, o.labels.projection) : []),
    ...selectionSeries(o, unit, p),
  ];
}

/** Grafiğin x ekseni öngörü/uzatma ufkunu da kapsasın. */
export function overlayMaxTs(o: TrendOverlay | undefined): number {
  const ts = [
    ...(o?.projection?.points ?? []).map((x) => x.ts),
    ...(o?.selectionExtension ?? []).map((x) => x.ts),
  ];
  return ts.length ? Math.max(...ts) : 0;
}
