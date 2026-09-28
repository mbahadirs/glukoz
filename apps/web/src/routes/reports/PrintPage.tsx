import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import dayjs from '../../lib/dayjs';
import { useCompare, useReport } from '../../lib/queries';
import { useSession } from '../../hooks/session';
import { usePatient } from '../../hooks/usePatient';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import type { ReportSearch } from '../router';
import { resolvePeriod } from './period';
import { ReportBody } from './ReportBody';

/** A4 yazdırma rotası: veriler ve grafikler hazır olunca bir kez `window.print()`. */
export function PrintPage() {
  const { t } = useTranslation();
  const { unit } = useSession();
  const { patient } = usePatient();
  const search = useSearch({ strict: false }) as ReportSearch;
  const tz = patient?.timezone ?? 'Europe/Istanbul';
  const period = resolvePeriod(search, tz);
  const report = useReport(patient?.id, period.from, period.to);
  const cmp = useCompare(patient?.id, period.from, period.to);
  const printed = useRef(false);
  const ready = !!report.data && !cmp.isLoading;

  useEffect(() => {
    if (!ready || printed.current) return;
    printed.current = true;
    document.title = `${patient?.name ?? ''} — ${t('print.title')}`;
    // grafikler SVG olarak çizilsin diye bir kare bekle
    const id = window.setTimeout(() => window.print(), 800);
    return () => window.clearTimeout(id);
  }, [ready, patient?.name, t]);

  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  return (
    <main className="mx-auto max-w-[190mm] space-y-4 bg-bg p-4 text-text">
      <header className="border-b border-border pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{t('print.title')}</h1>
            <p className="text-lg font-semibold">{patient.name}</p>
            <p className="num text-sm">
              {t('print.period')}: {dayjs(period.from).tz(tz).format('DD.MM.YYYY')} –{' '}
              {dayjs(period.to - 1)
                .tz(tz)
                .format('DD.MM.YYYY')}{' '}
              ({t('reports.days', { count: period.days })})
            </p>
            <p className="num text-xs text-muted">
              {t('print.generated', { time: dayjs().format('DD.MM.YYYY HH:mm') })}
            </p>
          </div>
          <button type="button" className="btn no-print" onClick={() => window.print()}>
            {t('print.print')}
          </button>
        </div>
        <p className="mt-2 text-xs">
          <strong>{t('disclaimer.title')}</strong> {t('disclaimer.medical')}
        </p>
      </header>
      {report.isLoading && <Loading />}
      {report.error && <ErrorBox error={report.error} />}
      {report.data && <ReportBody report={report.data} cmp={cmp.data} unit={unit} print />}
    </main>
  );
}
