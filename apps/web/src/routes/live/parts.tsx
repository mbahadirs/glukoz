import { useTranslation } from 'react-i18next';
import { classifyGlucose, unitLabel, type CurrentResponse, type GlucoseUnit } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { fmtDelta, fmtGlucose } from '../../lib/format';
import { TrendArrow } from '../../components/TrendArrow';
import { Card, Stat } from '../../components/ui';
import { TirStackedBar } from '../../components/charts/TirStackedBar';

export const AGE_WARN_SEC = 5 * 60;
export const AGE_STALE_SEC = 15 * 60;

const RANGE_TEXT: Record<string, string> = {
  veryLow: 'text-very-low',
  low: 'text-low',
  inRange: 'text-in-range',
  high: 'text-high',
  veryHigh: 'text-very-high',
};

export function ageClass(ageSec: number | null): 'ok' | 'warn' | 'stale' {
  if (ageSec === null) return 'stale';
  if (ageSec > AGE_STALE_SEC) return 'stale';
  if (ageSec > AGE_WARN_SEC) return 'warn';
  return 'ok';
}

export function CurrentValue({
  data,
  unit,
  now,
}: {
  data: CurrentResponse;
  unit: GlucoseUnit;
  now: number;
}) {
  const { t, i18n } = useTranslation();
  const r = data.reading;
  if (!r) return <p className="text-muted">{t('live.noReading')}</p>;
  const cls = classifyGlucose(r.mgdl);
  const ageSec = Math.max(0, Math.round((now - Date.parse(r.ts)) / 1000));
  const age = ageClass(ageSec);
  return (
    <div className="flex flex-col items-center gap-1 py-2 text-center" data-testid="current-value">
      <div className={`flex items-center gap-3 ${RANGE_TEXT[cls]}`} aria-live="polite">
        <span className="num text-7xl leading-none font-bold sm:text-8xl">
          {fmtGlucose(r.mgdl, unit, i18n.language)}
        </span>
        <TrendArrow trend={r.trend} className="text-6xl leading-none" />
      </div>
      <p className="text-sm">
        <span className="text-muted">{unitLabel(unit)}</span> ·{' '}
        <span className="font-semibold">{t(`ranges.${cls}`)}</span>
      </p>
      <p className="num text-base">
        {t('live.delta', {
          value: fmtDelta(data.delta, unit, i18n.language),
          unit: unitLabel(unit),
        })}
      </p>
      <p
        className={`num text-sm ${age === 'ok' ? 'text-muted' : age === 'warn' ? 'font-semibold text-high' : 'font-semibold text-low'}`}
      >
        {age !== 'ok' && <span aria-hidden>⏱ </span>}
        {t('live.updated', { ago: dayjs(r.ts).from(now) })}
      </p>
    </div>
  );
}

export function StaleStrip({ ageSec }: { ageSec: number | null }) {
  const { t } = useTranslation();
  if (ageClass(ageSec) !== 'stale') return null;
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-low bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-text"
    >
      ⚠ {t('live.stale')}
    </div>
  );
}

export function TodayCards({ data, unit }: { data: CurrentResponse; unit: GlucoseUnit }) {
  const { t, i18n } = useTranslation();
  const d = data.today;
  return (
    <Card title={t('live.today')}>
      {d.tir ? (
        <TirStackedBar tir={d.tir} />
      ) : (
        <p className="text-sm text-muted">{t('charts.noData')}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t('reports.mean')}
          value={fmtGlucose(d.mean, unit, i18n.language)}
          hint={unitLabel(unit)}
        />
        <Stat label={t('live.hypoCount')} value={d.hypoCount} />
        <Stat label={t('live.min')} value={fmtGlucose(d.min, unit, i18n.language)} />
        <Stat label={t('live.max')} value={fmtGlucose(d.max, unit, i18n.language)} />
      </dl>
    </Card>
  );
}

export function remainingText(
  sec: number,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (sec <= 0) return t('sensor.expired');
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3600);
  if (days === 0)
    return t('sensor.remainingHours', { hours, minutes: Math.floor((sec % 3600) / 60) });
  return t('sensor.remaining', { days, hours });
}

export function SensorCard({ data, tz }: { data: CurrentResponse; tz: string }) {
  const { t } = useTranslation();
  const s = data.sensor;
  if (!s) return null;
  const total = (Date.parse(s.expectedEnd) - Date.parse(s.activatedAt)) / 1000;
  const pct = Math.max(0, Math.min(100, (s.remainingSec / total) * 100));
  const soon = s.remainingSec < 86_400;
  return (
    <Card title={t('sensor.title')}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">{t('sensor.serial')}</dt>
        <dd className="num">{s.serial}</dd>
        <dt className="text-muted">{t('sensor.started')}</dt>
        <dd className="num">{dayjs(s.activatedAt).tz(tz).format('DD.MM.YYYY HH:mm')}</dd>
      </dl>
      <div className="mt-3">
        <div
          className="h-3 overflow-hidden rounded border border-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={t('sensor.remainingLabel')}
        >
          <div
            className={soon ? 'h-full bg-high' : 'h-full bg-in-range'}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`num mt-1 text-sm ${soon ? 'font-semibold text-high' : ''}`}>
          {soon && <span aria-hidden>⚠ </span>}
          {remainingText(s.remainingSec, t)}
        </p>
      </div>
    </Card>
  );
}
