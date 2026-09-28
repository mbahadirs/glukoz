import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventKind, GlucoseUnit, ReportResponse } from '@glukoz/shared';
import dayjs from '../../lib/dayjs';
import { fmtGlucose, fmtMinutes } from '../../lib/format';
import { Card, Empty, Stat } from '../../components/ui';

type SortKey = 'start' | 'durationMin' | 'extremeMgdl';

export function EventsSection({ report, unit }: { report: ReportResponse; unit: GlucoseUnit }) {
  const { t, i18n } = useTranslation();
  const [kind, setKind] = useState<EventKind | 'all'>('all');
  const [nightOnly, setNightOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'start', desc: true });
  const s = report.eventSummary;

  const rows = useMemo(
    () =>
      report.events
        .filter((e) => (kind === 'all' || e.kind === kind) && (!nightOnly || e.nocturnal))
        .toSorted((a, b) => (sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key])),
    [report.events, kind, nightOnly, sort],
  );

  const header = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className="font-semibold"
        onClick={() => setSort((p) => ({ key, desc: p.key === key ? !p.desc : true }))}
      >
        {label} {sort.key === key ? (sort.desc ? '↓' : '↑') : ''}
      </button>
    </th>
  );

  return (
    <Card title={t('reports.sections.events')}>
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('events.total')} value={s.total} />
        <Stat
          label={t('events.kinds.hypo_l1')}
          value={s.hypoL1}
          hint={t('events.nocturnalCount', { count: s.nocturnalHypo })}
        />
        <Stat
          label={t('events.kinds.hypo_l2')}
          value={s.hypoL2}
          hint={t('events.prolongedCount', { count: s.prolongedHypo })}
        />
        <Stat
          label={t('events.kinds.hyper')}
          value={s.hyper}
          hint={t('events.prolongedCount', { count: s.prolongedHyper })}
        />
        <Stat label={t('events.avgHypo')} value={fmtMinutes(s.avgHypoDurationMin, t)} />
        <Stat label={t('events.avgHyper')} value={fmtMinutes(s.avgHyperDurationMin, t)} />
      </dl>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('events.filter')}</span>
          <select
            className="input w-auto"
            value={kind}
            onChange={(e) => setKind(e.target.value as EventKind | 'all')}
          >
            <option value="all">{t('common.all')}</option>
            {(['hypo_l1', 'hypo_l2', 'hyper'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`events.kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nightOnly}
            onChange={(e) => setNightOnly(e.target.checked)}
          />
          {t('events.nightOnly')}
        </label>
      </div>
      {rows.length === 0 ? (
        <Empty>{t('events.none')}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="table num">
            <thead>
              <tr>
                <th>{t('events.type')}</th>
                {header('start', t('events.start'))}
                {header('durationMin', t('events.duration'))}
                {header('extremeMgdl', t('events.extreme'))}
                <th>{t('events.night')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={`${e.kind}-${e.start}`}>
                  <td>
                    {t(`events.kinds.${e.kind}`)}
                    {e.prolonged && (
                      <span className="ml-1 text-xs text-very-high">({t('events.prolonged')})</span>
                    )}
                    {e.ongoing && (
                      <span className="ml-1 text-xs text-muted">({t('events.ongoing')})</span>
                    )}
                  </td>
                  <td>{dayjs(e.start).tz(report.timezone).format('DD.MM.YYYY HH:mm')}</td>
                  <td>{fmtMinutes(e.durationMin, t)}</td>
                  <td>{fmtGlucose(e.extremeMgdl, unit, i18n.language)}</td>
                  <td>{e.nocturnal ? <span>☾ {t('common.yes')}</span> : t('common.no')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
