import { useTranslation } from 'react-i18next';
import type { GlucosePoint, GlucoseUnit } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { fmtDelta, fmtGlucose, fmtNumber, fmtRate, unitLabel } from '../../lib/format';
import { PROJECTION_HORIZON_MIN, type TrendState } from './useTrend';

interface Props {
  trend: TrendState;
  unit: GlucoseUnit;
  tz: string;
}

function at<T extends GlucosePoint>(
  points: T[],
  minutesAfter: number,
  from: number,
): T | undefined {
  return points.find((p) => p.ts === from + minutesAfter * 60_000);
}

/** Canlı grafik altında: veri sıklığı, öngörü ve iki nokta arası eğilim özeti. */
export function TrendPanel({ trend, unit, tz }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const u = unitLabel(unit);
  const g = (v: number) => fmtGlucose(v, unit, lang);
  const time = (ts: number) => dayjs(ts).tz(tz).format('HH:mm');
  const { projection, segment, selection } = trend;

  return (
    <div className="space-y-3 text-sm" data-testid="trend-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted">
          {trend.intervalMin !== null
            ? t('trend.interval', { value: fmtNumber(trend.intervalMin, 1, lang) })
            : t('trend.intervalUnknown')}
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={trend.showProjection} onChange={trend.toggleProjection} />
          {t('trend.showProjection')}
        </label>
      </div>

      {trend.showProjection && (
        <div className="rounded border border-border p-3" aria-live="polite">
          <p className="font-semibold">{t('trend.projectionTitle')}</p>
          {projection ? (
            <>
              <ul className="mt-1 space-y-0.5 tabular-nums">
                {[15, PROJECTION_HORIZON_MIN].map((m) => {
                  const p = at(projection.points, m, projection.anchor.ts);
                  return p ? (
                    <li key={m}>
                      {t('trend.projectionAt', {
                        minutes: m,
                        value: g(p.mgdl),
                        lo: g(p.lo),
                        hi: g(p.hi),
                        unit: u,
                      })}
                    </li>
                  ) : null;
                })}
              </ul>
              <p className="mt-1 text-muted">
                {t('trend.projectionBasis', {
                  rate: fmtRate(projection.slope, unit, lang),
                  unit: u,
                  count: projection.basedOn.count,
                  minutes: Math.round((projection.basedOn.to - projection.basedOn.from) / 60_000),
                })}
              </p>
            </>
          ) : (
            <p className="text-muted">{t('trend.projectionUnavailable')}</p>
          )}
        </div>
      )}

      <div className="rounded border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{t('trend.selectionTitle')}</p>
          {selection.length > 0 && (
            <button type="button" className="chip" onClick={trend.clear}>
              {t('trend.clear')}
            </button>
          )}
        </div>
        {selection.length === 0 && <p className="text-muted">{t('trend.selectHint')}</p>}
        {selection.length > 0 && (
          <ol className="mt-1 list-inside list-decimal tabular-nums">
            {[...selection]
              .sort((a, b) => a.ts - b.ts)
              .map((p) => (
                <li key={p.ts}>
                  {time(p.ts)} — {g(p.mgdl)} {u}
                </li>
              ))}
          </ol>
        )}
        {selection.length === 1 && <p className="text-muted">{t('trend.selectSecond')}</p>}
        {segment && (
          <div className="mt-1 tabular-nums">
            <p>
              {t('trend.segment', {
                delta: fmtDelta(segment.deltaMgdl, unit, lang),
                unit: u,
                minutes: fmtNumber(segment.minutes, 0, lang),
                rate: fmtRate(segment.ratePerMin, unit, lang),
              })}
            </p>
            {trend.extension.length > 0 && (
              <p className="text-muted">
                {t('trend.extension', {
                  minutes: PROJECTION_HORIZON_MIN,
                  value: g((trend.extension[trend.extension.length - 1] as GlucosePoint).mgdl),
                  unit: u,
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted" role="note">
        {t('trend.disclaimer')}
      </p>
    </div>
  );
}
