import type { GlucoseUnit, NoteDto } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { chartValue } from '../../lib/format';
import {
  CATEGORY_ICON,
  categoryOf,
  ENTRY_CATEGORIES,
  noteDetails,
  type EntryCategory,
} from '../../lib/notes';
import type { ChartPalette } from './palette';

type T = (k: string, o?: Record<string, unknown>) => string;

/** Tür başına şekil + renk (renk tek başına anlam taşımaz: şekil, simge ve lejant da var). */
const STYLE: Record<EntryCategory, { symbol: string; color: string }> = {
  insulin: { symbol: 'triangle', color: '#2563eb' },
  meal: { symbol: 'circle', color: '#d97706' },
  water: { symbol: 'diamond', color: '#0891b2' },
  sleep: { symbol: 'rect', color: '#7c3aed' },
  other: { symbol: 'pin', color: '' },
};

/** Girişin grafikteki yüksekliği: o andaki glukoz (±15 dk içindeki en yakın ölçüm), yoksa alt şerit. */
function yAt(ts: number, points: Array<[number, number]>, fallback: number): number {
  let best: [number, number] | null = null;
  for (const pt of points) if (!best || Math.abs(pt[0] - ts) < Math.abs(best[0] - ts)) best = pt;
  return best && Math.abs(best[0] - ts) <= 15 * 60_000 ? best[1] : fallback;
}

export function categoryLabel(c: EntryCategory, t: T): string {
  return `${CATEGORY_ICON[c]} ${t(`entry.categories.${c}`)}`;
}

export function entrySeries(
  notes: NoteDto[] | undefined,
  points: Array<[number, number]>,
  opts: { unit: GlucoseUnit; p: ChartPalette; t: T; tz: string; laneMgdl: number },
): unknown[] {
  if (!notes?.length) return [];
  const { unit, p, t, tz } = opts;
  const cv = (v: number) => chartValue(v, unit) as number;
  const byCat = new Map<EntryCategory, NoteDto[]>();
  for (const n of notes) {
    const c = categoryOf(n.type);
    byCat.set(c, [...(byCat.get(c) ?? []), n]);
  }
  return ENTRY_CATEGORIES.filter((c) => byCat.has(c)).map((c) => {
    const style = STYLE[c];
    const color = style.color || p.muted;
    const items = byCat.get(c) ?? [];
    const sleepAreas =
      c === 'sleep'
        ? items
            .filter((n) => n.durationMin)
            .map((n) => [
              { xAxis: Date.parse(n.ts), itemStyle: { color, opacity: 0.1 } },
              { xAxis: Date.parse(n.ts) + (n.durationMin as number) * 60_000 },
            ])
        : [];
    return {
      name: categoryLabel(c, t),
      type: 'scatter',
      symbol: style.symbol,
      symbolSize: 14,
      z: 8,
      itemStyle: { color, borderColor: p.bg, borderWidth: 1.5 },
      label: { show: true, position: 'top', formatter: CATEGORY_ICON[c], fontSize: 13 },
      tooltip: {
        trigger: 'item',
        formatter: (x: { dataIndex: number }) => {
          const n = items[x.dataIndex] as NoteDto;
          const parts = [
            `${dayjs(n.ts).tz(tz).format('DD MMM HH:mm')} ${CATEGORY_ICON[c]} ${t(`noteTypes.${n.type}`)}`,
            ...noteDetails(n, t),
            n.text ?? '',
          ];
          return parts.filter(Boolean).join(' · ');
        },
      },
      data: items.map((n) => {
        const ts = Date.parse(n.ts);
        return [ts, cv(yAt(ts, points, opts.laneMgdl))];
      }),
      ...(sleepAreas.length ? { markArea: { silent: true, data: sleepAreas } } : {}),
    };
  });
}
