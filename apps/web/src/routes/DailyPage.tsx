import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { addDays, zonedDayStart } from '@glukoz/metrics';
import { unitLabel, type DayResponse, type NoteDto } from '@glukoz/shared';
import dayjs, { todayIn } from '../lib/dayjs';
import { fmtGlucose, fmtMinutes, fmtPercent } from '../lib/format';
import { useDay, useDeleteNote } from '../lib/queries';
import { useSession } from '../hooks/session';
import { usePatient } from '../hooks/usePatient';
import { Card, Empty, ErrorBox, Loading, PageTitle, Stat } from '../components/ui';
import { PatientSelector } from '../components/PatientSelector';
import { NoteDialog } from '../components/NoteDialog';
import { GlucoseLineChart } from '../components/charts/GlucoseLineChart';
import { TirStackedBar } from '../components/charts/TirStackedBar';
import type { DailySearch } from './router';
import { CATEGORY_ICON, categoryOf, noteDetails } from '../lib/notes';

type Search = Record<string, unknown>;

function DaySummary({ day }: { day: DayResponse }) {
  const { t, i18n } = useTranslation();
  const { unit } = useSession();
  const s = day.summary;
  return (
    <Card title={t('daily.summary')}>
      <TirStackedBar tir={s.tir} />
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          label={t('reports.mean')}
          value={fmtGlucose(s.mean, unit, i18n.language)}
          hint={unitLabel(unit)}
        />
        <Stat label={t('live.min')} value={fmtGlucose(s.min, unit, i18n.language)} />
        <Stat label={t('live.max')} value={fmtGlucose(s.max, unit, i18n.language)} />
        <Stat label={t('daily.events')} value={s.eventCount} />
        <Stat
          label={t('reports.sufficiency')}
          value={fmtPercent(s.sufficiencyPercent, i18n.language)}
        />
        <Stat
          label={t('reports.gmi')}
          value={s.gmiPercent === null ? '–' : fmtPercent(s.gmiPercent, i18n.language)}
          hint={t('daily.gmiIndicative')}
        />
      </dl>
    </Card>
  );
}

function EventsList({ day }: { day: DayResponse }) {
  const { t, i18n } = useTranslation();
  const { unit } = useSession();
  if (!day.events.length) return null;
  return (
    <Card title={t('daily.events')}>
      <ul className="space-y-1 text-sm">
        {day.events.map((e) => (
          <li key={`${e.kind}-${e.start}`} className="num flex flex-wrap gap-2">
            <span className="font-semibold">{t(`events.kinds.${e.kind}`)}</span>
            <span>
              {dayjs(e.start).tz(day.timezone).format('HH:mm')}–
              {dayjs(e.end).tz(day.timezone).format('HH:mm')}
            </span>
            <span className="text-muted">{fmtMinutes(e.durationMin, t)}</span>
            <span>
              {t('events.extreme')}: {fmtGlucose(e.extremeMgdl, unit, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NotesTimeline({
  day,
  canEdit,
  onEdit,
  patientId,
}: {
  day: DayResponse;
  canEdit: boolean;
  onEdit: (n: NoteDto) => void;
  patientId: string;
}) {
  const { t } = useTranslation();
  const del = useDeleteNote(patientId);
  return (
    <Card title={t('daily.notes')}>
      {day.notes.length === 0 && <Empty>{t('notes.empty')}</Empty>}
      <ol className="space-y-2">
        {day.notes.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-center gap-2 border-l-2 border-accent pl-3 text-sm"
          >
            <span className="num font-semibold">
              {dayjs(n.ts).tz(day.timezone).format('HH:mm')}
            </span>
            <span>
              <span aria-hidden="true">{CATEGORY_ICON[categoryOf(n.type)]} </span>
              {t(`noteTypes.${n.type}`)}
            </span>
            {noteDetails(n, t).map((d) => (
              <span key={d} className="num text-muted">
                {d}
              </span>
            ))}
            {n.text && <span className="w-full text-muted">{n.text}</span>}
            {canEdit && (
              <span className="ml-auto flex gap-1">
                <button type="button" className="btn min-h-8 py-1" onClick={() => onEdit(n)}>
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="btn-danger min-h-8 py-1"
                  onClick={() => window.confirm(t('notes.confirmDelete')) && del.mutate(n.id)}
                >
                  {t('common.delete')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DailyPage() {
  const { t } = useTranslation();
  const { unit } = useSession();
  const { patient } = usePatient();
  const search = useSearch({ strict: false }) as DailySearch;
  const navigate = useNavigate();
  const tz = patient?.timezone ?? 'Europe/Istanbul';
  const date = search.date ?? todayIn(tz);
  const day = useDay(patient?.id, date);
  const compare = useDay(patient?.id, search.compare);
  const [editing, setEditing] = useState<NoteDto | null | undefined>(undefined);

  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  const go = (patch: Partial<DailySearch>) =>
    void navigate({ to: '/gunluk', search: (p: Search) => ({ ...p, ...patch }) });
  const from = zonedDayStart(date, tz);
  const to = zonedDayStart(addDays(date, 1), tz);
  const isToday = date >= todayIn(tz);

  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{t('nav.daily')}</PageTitle>
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className="btn"
          aria-label={t('daily.prev')}
          onClick={() => go({ date: addDays(date, -1) })}
        >
          ←
        </button>
        <label>
          <span className="sr-only">{t('daily.date')}</span>
          <input
            type="date"
            className="input w-auto"
            value={date}
            max={todayIn(tz)}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn"
          aria-label={t('daily.next')}
          disabled={isToday}
          onClick={() => go({ date: addDays(date, 1) })}
        >
          →
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">{t('daily.compareWith')}</span>
          <input
            type="date"
            className="input w-auto"
            value={search.compare ?? ''}
            max={todayIn(tz)}
            onChange={(e) => go({ compare: e.target.value || undefined })}
          />
        </label>
      </div>
      <p className="text-lg font-semibold">{dayjs(date).format('DD MMMM YYYY, dddd')}</p>

      {day.isLoading && <Loading />}
      {day.error && <ErrorBox error={day.error} />}
      {day.data && (
        <>
          <Card title={t('daily.chart')}>
            <GlucoseLineChart
              label={t('daily.chart')}
              points={day.data.readings}
              unit={unit}
              tz={tz}
              from={from}
              to={to}
              targetLow={patient.targetLow}
              targetHigh={patient.targetHigh}
              notes={day.data.notes}
              events={day.data.events}
              compare={
                compare.data && search.compare
                  ? {
                      points: compare.data.readings,
                      offsetMs: from - zonedDayStart(search.compare, tz),
                      label: dayjs(search.compare).format('DD.MM.YYYY'),
                    }
                  : undefined
              }
            />
            {search.compare && (
              <p className="text-xs text-muted">
                {t('daily.compareLegend', { date: dayjs(search.compare).format('DD.MM.YYYY') })}
              </p>
            )}
          </Card>
          <DaySummary day={day.data} />
          <EventsList day={day.data} />
          <NotesTimeline
            day={day.data}
            canEdit={patient.canEdit}
            onEdit={setEditing}
            patientId={patient.id}
          />
          {patient.canEdit && (
            <button type="button" className="btn-primary" onClick={() => setEditing(null)}>
              + {t('notes.add')}
            </button>
          )}
        </>
      )}
      {patient.canEdit && (
        <NoteDialog
          open={editing !== undefined}
          onClose={() => setEditing(undefined)}
          patientId={patient.id}
          tz={tz}
          note={editing}
        />
      )}
    </div>
  );
}
