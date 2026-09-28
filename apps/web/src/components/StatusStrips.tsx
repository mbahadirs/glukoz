import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { AlertEventDto } from '@glukoz/shared';
import dayjs from '../lib/dayjs';
import { useOnline } from '../hooks/useOnline';
import { useAckAlert, useActiveAlerts } from '../lib/queries';
import { useSession } from '../hooks/session';

const URGENT = new Set(['urgent_low', 'low', 'rapid_fall']);

export function OfflineStrip() {
  const { t } = useTranslation();
  const online = useOnline();
  const qc = useQueryClient();
  if (online) return null;
  const updated = qc
    .getQueryCache()
    .findAll({ queryKey: ['current'] })
    .map((q) => q.state.dataUpdatedAt)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  return (
    <div role="status" className="bg-warn-bg px-4 py-2 text-sm font-medium text-warn-text">
      {updated
        ? t('offline.withTime', { time: dayjs(updated).format('HH:mm') })
        : t('offline.noData')}
    </div>
  );
}

function AlertRow({ a }: { a: AlertEventDto }) {
  const { t } = useTranslation();
  const ack = useAckAlert();
  const { me, patients } = useSession();
  const urgent = URGENT.has(a.kind ?? '');
  const patient = patients.find((p) => p.id === a.patientId);
  const canAck = me?.user.role !== 'VIEWER';
  return (
    <li
      className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm ${urgent ? 'bg-danger-bg text-danger-text' : 'bg-warn-bg text-warn-text'}`}
    >
      <span aria-hidden>{urgent ? '⚠' : '!'}</span>
      <span className="font-semibold">{patient?.name}</span>
      <span>{a.message}</span>
      <span className="num text-xs opacity-80">{dayjs(a.firedAt).format('HH:mm')}</span>
      {canAck && (
        <button
          type="button"
          className="btn ml-auto min-h-8 py-1"
          disabled={ack.isPending}
          onClick={() => ack.mutate(a.id)}
        >
          {t('alerts.ack')}
        </button>
      )}
    </li>
  );
}

export function AlertStrip() {
  const { t } = useTranslation();
  const { isAuthenticated, needsConsent } = useSession();
  const { data } = useActiveAlerts(isAuthenticated && !needsConsent);
  if (!data?.length) return null;
  return (
    <section aria-label={t('alerts.active')} aria-live="assertive">
      <ul>
        {data.slice(0, 3).map((a) => (
          <AlertRow key={a.id} a={a} />
        ))}
      </ul>
    </section>
  );
}
