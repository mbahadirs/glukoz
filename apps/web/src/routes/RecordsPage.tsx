import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_TYPES } from '@glukoz/shared';
import dayjs from '../lib/dayjs';
import { fmtGlucose } from '../lib/format';
import { useLogbook, useNotes } from '../lib/queries';
import { useSession } from '../hooks/session';
import { usePatient } from '../hooks/usePatient';
import { useNow } from '../hooks/useNow';
import { Card, Empty, ErrorBox, Loading, PageTitle } from '../components/ui';
import { PatientSelector } from '../components/PatientSelector';
import { CATEGORY_ICON, categoryOf, noteDetails } from '../lib/notes';

const RANGE_DAYS = [7, 14, 30] as const;
const HOUR = 3600_000;

interface Row {
  key: string;
  ts: number;
  source: 'note' | 'scan' | 'alarm';
  title: string;
  detail: string;
}

type Filter = 'all' | 'note' | 'scan' | 'alarm' | (typeof NOTE_TYPES)[number];

export function RecordsPage() {
  const { t, i18n } = useTranslation();
  const { unit } = useSession();
  const { patient } = usePatient();
  const [days, setDays] = useState<number>(14);
  const [filter, setFilter] = useState<Filter>('all');
  const to = Math.ceil(useNow(HOUR) / HOUR) * HOUR;
  const from = to - days * 86_400_000;
  const notes = useNotes(patient?.id, from, to);
  const logbook = useLogbook(patient?.id, from, to);

  const rows = useMemo<Row[]>(() => {
    const n: Row[] = (notes.data ?? []).map((x) => ({
      key: `n-${x.id}`,
      ts: Date.parse(x.ts),
      source: 'note',
      title: `${CATEGORY_ICON[categoryOf(x.type)]} ${t(`noteTypes.${x.type}`)}`,
      detail: [...noteDetails(x, t), x.text ?? ''].filter(Boolean).join(' · '),
    }));
    const l: Row[] = (logbook.data ?? []).map((x, i) => ({
      key: `l-${x.ts}-${i}`,
      ts: Date.parse(x.ts),
      source: x.kind,
      title: x.kind === 'scan' ? t('records.scan') : t('records.alarm'),
      detail: fmtGlucose(x.mgdl, unit, i18n.language),
    }));
    const noteType = (r: Row) => notes.data?.find((x) => `n-${x.id}` === r.key)?.type;
    return [...n, ...l]
      .filter((r) => filter === 'all' || r.source === filter || noteType(r) === filter)
      .toSorted((a, b) => b.ts - a.ts);
  }, [notes.data, logbook.data, filter, t, unit, i18n.language]);

  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  const loading = notes.isLoading || logbook.isLoading;

  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{t('nav.records')}</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
          >
            {t('reports.days', { count: d })}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">{t('records.filter')}</span>
          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">{t('common.all')}</option>
            <option value="note">{t('records.notes')}</option>
            <option value="scan">{t('records.scan')}</option>
            <option value="alarm">{t('records.alarm')}</option>
            {NOTE_TYPES.map((nt) => (
              <option key={nt} value={nt}>
                {t(`noteTypes.${nt}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && <Loading />}
      {notes.error && <ErrorBox error={notes.error} />}
      {logbook.error && <ErrorBox error={logbook.error} />}
      <Card>
        {!loading && rows.length === 0 && <Empty>{t('records.empty')}</Empty>}
        <ol className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className={`flex flex-wrap gap-2 border-l-2 pl-3 text-sm ${r.source === 'note' ? 'border-accent' : r.source === 'alarm' ? 'border-low' : 'border-border'}`}
            >
              <span className="num w-32 text-muted">
                {dayjs(r.ts).tz(patient.timezone).format('DD.MM HH:mm')}
              </span>
              <span className="font-semibold">
                {r.source === 'alarm' && <span aria-hidden>⚠ </span>}
                {r.title}
              </span>
              <span className="num">{r.detail}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
