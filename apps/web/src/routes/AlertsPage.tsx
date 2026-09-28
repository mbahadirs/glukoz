import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from '../lib/dayjs';
import { fmtGlucose } from '../lib/format';
import { useAckAlert, useAlertRules, usePatientAlerts } from '../lib/queries';
import { useSession } from '../hooks/session';
import { usePatient } from '../hooks/usePatient';
import { usePush } from '../hooks/usePush';
import { isIos, isStandalone } from '../hooks/useInstallPrompt';
import { Card, Empty, ErrorBox, Loading, PageTitle } from '../components/ui';
import { PatientSelector } from '../components/PatientSelector';
import { RuleEditor } from './alerts/RuleEditor';

function PushCard() {
  const { t } = useTranslation();
  const push = usePush();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Card title={t('push.title')}>
      <p className="mb-2 text-sm">{t(`push.state.${push.state}`)}</p>
      <div className="flex flex-wrap gap-2">
        {push.state === 'unsubscribed' && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void run(push.subscribe, t('push.enabled'))}
          >
            {t('push.enable')}
          </button>
        )}
        {push.state === 'subscribed' && (
          <>
            <button
              type="button"
              className="btn"
              onClick={() =>
                void run(async () =>
                  setMsg(t('push.testSent', { count: (await push.test()).sent })),
                )
              }
            >
              {t('push.test')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void run(push.unsubscribe, t('push.disabled'))}
            >
              {t('push.disable')}
            </button>
          </>
        )}
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm text-ok">
          {msg}
        </p>
      )}
      {error ? (
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      ) : null}
      {isIos() && !isStandalone() && (
        <p className="mt-3 rounded-md bg-warn-bg p-2 text-sm text-warn-text">{t('push.iosNote')}</p>
      )}
      <p className="mt-3 text-xs text-muted">{t('push.delayNote')}</p>
    </Card>
  );
}

export function AlertsPage() {
  const { t, i18n } = useTranslation();
  const { unit, me } = useSession();
  const { patient } = usePatient();
  const history = usePatientAlerts(patient?.id);
  const rules = useAlertRules(patient?.id);
  const ack = useAckAlert();
  if (!patient) return <Empty>{t('patient.none')}</Empty>;
  const canAck = me?.user.role !== 'VIEWER';

  return (
    <div className="space-y-4">
      <PageTitle actions={<PatientSelector />}>{t('nav.alerts')}</PageTitle>
      <PushCard />
      <Card title={t('alerts.history')}>
        {history.isLoading && <Loading />}
        {history.error && <ErrorBox error={history.error} />}
        {history.data?.length === 0 && <Empty>{t('alerts.none')}</Empty>}
        <ul className="divide-y divide-border">
          {history.data?.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="num w-32 text-muted">
                {dayjs(a.firedAt).tz(patient.timezone).format('DD.MM HH:mm')}
              </span>
              <span className="font-semibold">{a.kind ? t(`alertKinds.${a.kind}`) : ''}</span>
              <span>{a.message}</span>
              {a.mgdl !== null && (
                <span className="num">{fmtGlucose(a.mgdl, unit, i18n.language)}</span>
              )}
              <span className="ml-auto">
                {a.ackAt ? (
                  <span className="text-xs text-muted">
                    ✓ {t('alerts.acked', { time: dayjs(a.ackAt).format('DD.MM HH:mm') })}
                  </span>
                ) : (
                  canAck && (
                    <button
                      type="button"
                      className="btn min-h-8 py-1"
                      onClick={() => ack.mutate(a.id)}
                    >
                      {t('alerts.ack')}
                    </button>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('alerts.rules')}>
        {rules.isLoading && <Loading />}
        {rules.error && <ErrorBox error={rules.error} />}
        {rules.data && (
          <RuleEditor patientId={patient.id} rules={rules.data} canEdit={patient.canEdit} />
        )}
      </Card>
    </div>
  );
}
