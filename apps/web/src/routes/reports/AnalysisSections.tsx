import { useTranslation } from 'react-i18next';
import { unitLabel, type GlucoseUnit, type ReportResponse } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { fmtGlucose, fmtNumber, fmtPercent } from '../../lib/format';
import { Card, Stat } from '../../components/ui';
import { ComparisonBars } from '../../components/charts/ComparisonBars';
import { GriGrid } from '../../components/charts/GriGrid';

const WEEKDAY_ISO = [
  '',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function PeriodsSection({ report, unit }: { report: ReportResponse; unit: GlucoseUnit }) {
  const { t } = useTranslation();
  const meanLabel = t('reports.mean');
  const tirLabel = t('ranges.inRangeShort');
  return (
    <Card title={t('reports.sections.periods')}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t('reports.periodsOfDay')}</h3>
          <ComparisonBars
            categories={report.periods.map((p) => t(`periods.${p.period}`))}
            means={report.periods.map((p) => p.mean)}
            tir={report.periods.map((p) => p.tirPercent)}
            unit={unit}
            meanLabel={meanLabel}
            tirLabel={tirLabel}
            label={t('reports.periodsOfDay')}
            summary={report.periods
              .map(
                (p) =>
                  `${t(`periods.${p.period}`)}: ${p.mean ?? '–'} mg/dL, TIR ${p.tirPercent ?? '–'}%, ${t('reports.hypoCount', { count: p.hypoCount })}`,
              )
              .join('; ')}
          />
          <ul className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
            {report.periods.map((p) => (
              <li key={p.period}>
                {t(`periods.${p.period}`)}: {t('reports.hypoCount', { count: p.hypoCount })}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t('reports.weekdays')}</h3>
          <ComparisonBars
            categories={report.weekdays.map((w) => t(`weekdays.${WEEKDAY_ISO[w.weekday]}`))}
            means={report.weekdays.map((w) => w.mean)}
            tir={report.weekdays.map((w) => w.tirPercent)}
            unit={unit}
            meanLabel={meanLabel}
            tirLabel={tirLabel}
            label={t('reports.weekdays')}
            summary={report.weekdays
              .map(
                (w) =>
                  `${t(`weekdays.${WEEKDAY_ISO[w.weekday]}`)}: ${w.mean ?? '–'}, TIR ${w.tirPercent ?? '–'}%`,
              )
              .join('; ')}
          />
        </div>
      </div>
    </Card>
  );
}

export function MealsSection({ report, unit }: { report: ReportResponse; unit: GlucoseUnit }) {
  const { t, i18n } = useTranslation();
  const { responses, averages } = report.meals;
  if (!responses.length) return null;
  const g = (v: number | null) => fmtGlucose(v, unit, i18n.language);
  return (
    <Card title={t('reports.sections.meals')}>
      <p className="mb-2 text-xs text-muted">{t('meals.intro', { unit: unitLabel(unit) })}</p>
      <div className="overflow-x-auto">
        <table className="table num">
          <thead>
            <tr>
              <th>{t('meals.kind')}</th>
              <th>{t('meals.count')}</th>
              <th>{t('meals.pre')}</th>
              <th>{t('meals.at1h')}</th>
              <th>{t('meals.at2h')}</th>
              <th>{t('meals.peak')}</th>
              <th>{t('meals.toPeak')}</th>
            </tr>
          </thead>
          <tbody>
            {averages.map((a) => (
              <tr key={a.mealKind}>
                <td>{t(`meals.kinds.${a.mealKind}`)}</td>
                <td>{a.count}</td>
                <td>{g(a.preMgdl)}</td>
                <td>{g(a.at1hMgdl)}</td>
                <td>{g(a.at2hMgdl)}</td>
                <td>{g(a.peakMgdl)}</td>
                <td>
                  {a.minutesToPeak === null ? '–' : t('units.minutes', { count: a.minutesToPeak })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer">
          {t('meals.details', { count: responses.length })}
        </summary>
        <ul className="num mt-2 space-y-1">
          {responses.map((r) => (
            <li key={r.noteId}>
              {dayjs(r.ts).tz(report.timezone).format('DD.MM HH:mm')} ·{' '}
              {t(`meals.kinds.${r.mealKind}`)}
              {r.carbsG !== null && ` · ${r.carbsG} g`} · {g(r.preMgdl)} → {g(r.peakMgdl)}
              {r.minutesToPeak !== null && ` (${t('units.minutes', { count: r.minutesToPeak })})`}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function AdvancedSection({ report, unit }: { report: ReportResponse; unit: GlucoseUnit }) {
  const { t, i18n } = useTranslation();
  const s = report.stats;
  const g = (v: number | null) => fmtGlucose(v, unit, i18n.language);
  return (
    <Card title={t('reports.sections.advanced')}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t('reports.gri.title')}</h3>
          <p className="num mb-2 text-sm">
            GRI <strong>{fmtNumber(report.gri.gri, 1, i18n.language)}</strong> ·{' '}
            {t('reports.gri.zone', { zone: report.gri.zone })} · {t('reports.gri.hypo')}{' '}
            {fmtNumber(report.gri.hypoComponent, 1, i18n.language)} · {t('reports.gri.hyper')}{' '}
            {fmtNumber(report.gri.hyperComponent, 1, i18n.language)}
          </p>
          <GriGrid gri={report.gri} />
        </div>
        <dl className="grid grid-cols-2 content-start gap-4">
          <Stat
            label={t('reports.lbgi')}
            value={fmtNumber(report.risk.lbgi, 2, i18n.language)}
            hint={t('reports.lbgiHint')}
          />
          <Stat
            label={t('reports.hbgi')}
            value={fmtNumber(report.risk.hbgi, 2, i18n.language)}
            hint={t('reports.hbgiHint')}
          />
          <Stat label={t('reports.sd')} value={g(s.sd)} hint={unitLabel(unit)} />
          <Stat label={t('reports.median')} value={g(s.median)} hint={unitLabel(unit)} />
          <Stat label={t('reports.iqr')} value={g(s.iqr)} hint={`${g(s.q1)} – ${g(s.q3)}`} />
          <Stat
            label={t('ranges.tightRange')}
            value={fmtPercent(report.tir.tightRange.percent, i18n.language)}
            hint={t('ranges.tightRangeRange')}
          />
          <Stat label={t('live.min')} value={g(s.min)} />
          <Stat label={t('live.max')} value={g(s.max)} />
        </dl>
      </div>
    </Card>
  );
}
