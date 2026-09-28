import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NoteType } from '@glukoz/shared';
import { useSession } from '../hooks/session';
import { usePatient } from '../hooks/usePatient';
import { useStream, FALLBACK_POLL_MS } from '../hooks/useStream';
import { useNow } from '../hooks/useNow';
import { useCurrent, useNotes, useReadings } from '../lib/queries';
import { Card, Empty, ErrorBox, Loading, PageTitle } from '../components/ui';
import { PatientSelector } from '../components/PatientSelector';
import { NoteDialog } from '../components/NoteDialog';
import { GlucoseLineChart } from '../components/charts/GlucoseLineChart';
import { CurrentValue, SensorCard, StaleStrip, TodayCards } from './live/parts';
import { TrendPanel } from './live/TrendPanel';
import { useTrend } from './live/useTrend';
import { CATEGORY_ICON, ENTRY_CATEGORIES } from '../lib/notes';
import { DEFAULT_TYPE } from '../components/entryForm';
import type { LiveSearch } from './router';

const HOURS = [3, 6, 12, 24] as const;
const MINUTE = 60_000;
const EMPTY: Array<[number, number]> = [];
type Search = Record<string, unknown>;

export function LivePage() {
  const { t } = useTranslation();
  const { unit } = useSession();
  const { patient } = usePatient();
  const search = useSearch({ strict: false }) as LiveSearch;
  const navigate = useNavigate();
  const hours = (HOURS as readonly number[]).includes(search.hours ?? 0)
    ? (search.hours as number)
    : 6;
  const { connected } = useStream(patient?.id);
  const current = useCurrent(patient?.id, connected ? false : FALLBACK_POLL_MS);
  const nowMin = Math.floor(useNow(MINUTE) / MINUTE) * MINUTE;
  const now = useNow(15_000);
  const from = nowMin - hours * 3600_000;
  const to = nowMin + MINUTE;
  // Ham ölçümler: LibreLinkUp ne sıklıkta veriyorsa (anlık ~1 dk, geçmiş 15 dk) o sıklıkta çizilir.
  const readings = useReadings(patient?.id, from, to, 'raw');
  const trend = useTrend(readings.data?.points ?? EMPTY, now, patient?.id);
  const notes = useNotes(patient?.id, from, to);
  const [noteType, setNoteType] = useState<NoteType | null>(search.note ? 'meal' : null);

  if (!patient) return <Empty>{t('patient.none')}</Empty>;

  const closeNote = () => {
    setNoteType(null);
    if (search.note) void navigate({ to: '/', search: (p: Search) => ({ ...p, note: undefined }) });
  };
  const setHours = (h: number) =>
    void navigate({ to: '/', search: (p: Search) => ({ ...p, hours: h }) });
  const ageSec = current.data?.reading
    ? Math.round((now - Date.parse(current.data.reading.ts)) / 1000)
    : null;

  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{patient.name}</PageTitle>
      {current.data && <StaleStrip ageSec={ageSec} />}
      <Card>
        {current.isLoading && <Loading />}
        {current.error && <ErrorBox error={current.error} />}
        {current.data && <CurrentValue data={current.data} unit={unit} now={now} />}
        {!connected && current.data && (
          <p className="text-center text-xs text-muted">{t('live.polling')}</p>
        )}
      </Card>

      <Card
        title={t('live.chart')}
        actions={
          <div className="flex gap-1" role="group" aria-label={t('live.range')}>
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                className="chip"
                aria-pressed={h === hours}
                onClick={() => setHours(h)}
              >
                {t('live.hours', { count: h })}
              </button>
            ))}
          </div>
        }
      >
        {readings.error ? (
          <ErrorBox error={readings.error} />
        ) : (
          <GlucoseLineChart
            label={t('live.chart')}
            points={readings.data?.points ?? []}
            unit={unit}
            tz={patient.timezone}
            from={from}
            to={to}
            targetLow={patient.targetLow}
            targetHigh={patient.targetHigh}
            notes={notes.data}
            onSelectPoint={trend.select}
            overlay={{
              projection: trend.projection,
              selection: trend.selection,
              selectionExtension: trend.extension,
              labels: {
                projection: t('trend.projectionSeries'),
                selection: t('trend.selectionSeries'),
                extension: t('trend.extensionSeries'),
              },
            }}
          />
        )}
        <div className="mt-3">
          <TrendPanel trend={trend} unit={unit} tz={patient.timezone} />
        </div>
      </Card>

      {patient.canEdit && (
        <Card title={t('entry.quickTitle')}>
          <div className="grid grid-cols-5 gap-2" data-testid="quick-entry">
            {ENTRY_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="btn flex flex-col items-center gap-1 py-3"
                onClick={() => setNoteType(DEFAULT_TYPE[c])}
              >
                <span aria-hidden="true" className="text-2xl">
                  {CATEGORY_ICON[c]}
                </span>
                <span className="text-xs">{t(`entry.categories.${c}`)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t('entry.quickHint')}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {current.data && <TodayCards data={current.data} unit={unit} />}
        {current.data && <SensorCard data={current.data} tz={patient.timezone} />}
      </div>

      {patient.canEdit && (
        <NoteDialog
          open={noteType !== null}
          onClose={closeNote}
          patientId={patient.id}
          tz={patient.timezone}
          defaultType={noteType ?? 'meal'}
        />
      )}
    </div>
  );
}
