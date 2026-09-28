import { useTranslation } from 'react-i18next';
import type { DailySummary, GlucoseUnit } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { fmtGlucose, fmtPercent } from '../../lib/format';
import { zonedDayStart } from '@glukoz/metrics';
import { TirStackedBar } from './TirStackedBar';

interface Props {
  days: DailySummary[];
  tz: string;
  unit: GlucoseUnit;
  targetLow: number;
  targetHigh: number;
}

const W = 160;
const H = 60;
const MAX = 350;
const y = (v: number) => H - (Math.min(v, MAX) / MAX) * H;

/** Hafif SVG küçük çoklu grafikler — onlarca günde bile hızlı ve baskı dostu. */
function DaySpark({
  day,
  tz,
  targetLow,
  targetHigh,
}: {
  day: DailySummary;
  tz: string;
  targetLow: number;
  targetHigh: number;
}) {
  const start = zonedDayStart(day.date, tz);
  const x = (ts: number) => ((ts - start) / 86_400_000) * W;
  // > 20 dk boşlukta yeni alt yol (M) başlar → çizgi kesilir
  let path = '';
  let prev: number | null = null;
  for (const [ts, v] of day.slots ?? []) {
    const gap = prev === null || ts - prev > 20 * 60_000;
    path += `${gap ? 'M' : 'L'}${x(ts).toFixed(1)},${y(v).toFixed(1)}`;
    prev = ts;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" aria-hidden preserveAspectRatio="none">
      <rect
        x={0}
        y={y(targetHigh)}
        width={W}
        height={y(targetLow) - y(targetHigh)}
        fill="var(--target-band)"
      />
      <line x1={0} x2={W} y1={y(70)} y2={y(70)} stroke="var(--g-low)" strokeWidth={0.5} />
      <line x1={0} x2={W} y1={y(180)} y2={y(180)} stroke="var(--g-high)" strokeWidth={0.5} />
      <path
        d={path}
        fill="none"
        stroke="var(--text)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DailySmallMultiples({ days, tz, unit, targetLow, targetHigh }: Props) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => (
        <li key={d.date} className="print-avoid rounded border border-border p-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">{dayjs(d.date).format('dd DD.MM')}</span>
            <span className="num text-muted" title={t('reports.mean')}>
              ⌀ {fmtGlucose(d.mean, unit, i18n.language)}
            </span>
          </div>
          {d.slots && d.slots.length > 0 ? (
            <DaySpark day={d} tz={tz} targetLow={targetLow} targetHigh={targetHigh} />
          ) : (
            <p className="flex h-16 items-center justify-center text-xs text-muted">
              {t('charts.noData')}
            </p>
          )}
          <TirStackedBar tir={d.tir} compact />
          <p className="num mt-1 text-xs text-muted">
            {t('ranges.inRangeShort')} {fmtPercent(d.tir.inRange.percent, i18n.language)} ·{' '}
            {t('reports.sufficiencyShort')} {fmtPercent(d.sufficiencyPercent, i18n.language)}
          </p>
        </li>
      ))}
    </ul>
  );
}
