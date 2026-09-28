import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import dayjs, { todayIn } from '../../lib/dayjs';
import { buildUrl } from '../../lib/api';
import { patientPath, useCompare, useReport } from '../../lib/queries';
import { useSession } from '../../hooks/session';
import { usePatient } from '../../hooks/usePatient';
import { Empty, ErrorBox, Loading, PageTitle } from '../../components/ui';
import { PatientSelector } from '../../components/PatientSelector';
import type { ReportSearch } from '../router';
import { PERIOD_DAYS, resolvePeriod } from './period';
import { ReportBody } from './ReportBody';

type Search = Record<string, unknown>;

function PeriodPicker({
  search,
  tz,
  onChange,
}: {
  search: ReportSearch;
  tz: string;
  onChange: (s: Partial<ReportSearch>) => void;
}) {
  const { t } = useTranslation();
  const custom = !!(search.from && search.to);
  const [range, setRange] = useState({ from: search.from ?? '', to: search.to ?? todayIn(tz) });
  const active = custom ? 0 : (search.days ?? 14);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex gap-1" role="group" aria-label={t('reports.period')}>
        {PERIOD_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={active === d}
            onClick={() => onChange({ days: d, from: undefined, to: undefined })}
          >
            {t('reports.days', { count: d })}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (range.from && range.to) onChange({ from: range.from, to: range.to, days: undefined });
        }}
      >
        <label className="text-sm">
          <span className="label">{t('reports.customFrom')}</span>
          <input
            type="date"
            className="input w-auto"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="label">{t('reports.customTo')}</span>
          <input
            type="date"
            className="input w-auto"
            value={range.to}
            max={todayIn(tz)}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <button type="submit" className="chip" aria-pressed={custom}>
          {t('reports.apply')}
        </button>
      </form>
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { unit } = useSession();
  const { patient } = usePatient();
  const search = useSearch({ strict: false }) as ReportSearch;
  const navigate = useNavigate();
  const tz = patient?.timezone ?? 'Europe/Istanbul';
  const period = resolvePeriod(search, tz);
  const report = useReport(patient?.id, period.from, period.to);
  const cmp = useCompare(patient?.id, period.from, period.to);

  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  const setSearch = (s: Partial<ReportSearch>) =>
    void navigate({ to: '/raporlar', search: (p: Search) => ({ ...p, ...s }) });
  const csvUrl = buildUrl(`${patientPath(patient.id)}/export.csv`, {
    from: period.from,
    to: period.to,
  });
  const openPrint = () =>
    window.open(
      buildUrl('/raporlar/yazdir', {
        patient: patient.id,
        days: search.days,
        from: search.from,
        to: search.to,
      }),
      '_blank',
      'noopener',
    );

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <PatientSelector />
            <a className="btn" href={csvUrl} download>
              {t('reports.exportCsv')}
            </a>
            <button type="button" className="btn-primary" onClick={openPrint}>
              {t('reports.exportPdf')}
            </button>
          </div>
        }
      >
        {t('nav.reports')}
      </PageTitle>
      <PeriodPicker search={search} tz={tz} onChange={setSearch} />
      <p className="num text-sm text-muted">
        {dayjs(period.from).tz(tz).format('DD.MM.YYYY')} –{' '}
        {dayjs(period.to - 1)
          .tz(tz)
          .format('DD.MM.YYYY')}{' '}
        · {t('reports.days', { count: period.days })}
      </p>
      {report.isLoading && <Loading />}
      {report.error && <ErrorBox error={report.error} />}
      {report.data && <ReportBody report={report.data} cmp={cmp.data} unit={unit} />}
    </div>
  );
}
