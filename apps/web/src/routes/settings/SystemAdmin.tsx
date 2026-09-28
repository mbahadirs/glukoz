import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DeleteDataStep1Response,
  ImportResponse,
  PatientSummary,
  SystemStatusResponse,
} from '@glukoz/shared';
import { api } from '../../lib/api';
import dayjs from '../../lib/dayjs';
import { fmtPercent } from '../../lib/format';
import { invalidatePatientData, patientPath } from '../../lib/queries';
import { Card, ErrorBox, Loading } from '../../components/ui';

const TROUBLE_KEYS = ['v920', 'header', 's2', 's4', 'empty', 'r429', 'delay', 'gaps'] as const;

export function SystemStatusCard() {
  const { t, i18n } = useTranslation();
  const status = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api<SystemStatusResponse>('/api/system/status'),
    refetchInterval: 60_000,
  });
  const s = status.data;
  return (
    <Card title={t('system.title')}>
      {status.isLoading && <Loading />}
      {status.error && <ErrorBox error={status.error} />}
      {s && (
        <>
          <p className="num text-sm">
            LLU: {s.llu.product} / {s.llu.version}{' '}
            {s.llu.mock && <strong>({t('system.mock')})</strong>}
            {s.llu.minimumVersionSeen && (
              <span className="ml-2 text-very-high">
                ⚠ {t('system.minVersion', { v: s.llu.minimumVersionSeen })}
              </span>
            )}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="table num">
              <thead>
                <tr>
                  <th>{t('llu.label')}</th>
                  <th>{t('system.status')}</th>
                  <th>{t('system.lastSuccess')}</th>
                  <th>{t('system.successRate')}</th>
                  <th>{t('system.lastError')}</th>
                </tr>
              </thead>
              <tbody>
                {s.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    <td>{t(`llu.status.${a.status}`, { defaultValue: a.status })}</td>
                    <td>
                      {a.lastSuccessAt ? dayjs(a.lastSuccessAt).format('DD.MM HH:mm:ss') : '–'}
                    </td>
                    <td>
                      {a.successRate24h === null
                        ? '–'
                        : `${fmtPercent(a.successRate24h * 100, i18n.language)} (${a.runs24h})`}
                    </td>
                    <td>{a.lastErrorCode ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">{t('system.troubleshooting')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>{t('system.symptom')}</th>
                <th>{t('system.cause')}</th>
                <th>{t('system.fix')}</th>
              </tr>
            </thead>
            <tbody>
              {TROUBLE_KEYS.map((k) => (
                <tr key={k}>
                  <td>{t(`trouble.${k}.symptom`)}</td>
                  <td>{t(`trouble.${k}.cause`)}</td>
                  <td>{t(`trouble.${k}.fix`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

export function ImportCard({ patient }: { patient: PatientSummary }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      return api<ImportResponse>(`${patientPath(patient.id)}/import/libreview-csv`, {
        method: 'POST',
        formData: fd,
      });
    },
    onSuccess: () => invalidatePatientData(qc),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (file) upload.mutate(file);
  };
  return (
    <Card title={t('import.title', { name: patient.name })}>
      <p className="mb-2 text-sm text-muted">{t('import.intro')}</p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label={t('import.file')}
        />
        <button type="submit" className="btn-primary" disabled={!file || upload.isPending}>
          {t('import.upload')}
        </button>
      </form>
      {upload.data && (
        <p role="status" className="mt-2 text-sm text-ok">
          ✓ {t('import.result', upload.data as unknown as Record<string, unknown>)}
        </p>
      )}
      {upload.error && (
        <div className="mt-2">
          <ErrorBox error={upload.error} />
        </div>
      )}
    </Card>
  );
}

export function DeleteDataCard({ patient }: { patient: PatientSummary }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<DeleteDataStep1Response | null>(null);
  const [name, setName] = useState('');
  const path = `${patientPath(patient.id)}/data`;
  const start = useMutation({
    mutationFn: () => api<DeleteDataStep1Response>(path, { method: 'DELETE', body: {} }),
    onSuccess: setStep,
  });
  const confirm = useMutation({
    mutationFn: () =>
      api(path, {
        method: 'DELETE',
        body: { confirmToken: step?.confirmToken, confirmName: name },
      }),
    onSuccess: () => {
      setStep(null);
      setName('');
      qc.clear();
    },
  });
  return (
    <Card title={t('deleteData.title', { name: patient.name })}>
      <p className="mb-2 text-sm">{t('deleteData.intro')}</p>
      {!step ? (
        <button
          type="button"
          className="btn-danger"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          {t('deleteData.start')}
        </button>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="label">
              {t('deleteData.typeName', { name: step.confirmName, sec: step.expiresInSec })}
            </span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-danger"
              disabled={name !== step.confirmName || confirm.isPending}
            >
              {t('deleteData.confirm')}
            </button>
            <button type="button" className="btn" onClick={() => setStep(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
      {confirm.isSuccess && (
        <p role="status" className="mt-2 text-sm text-ok">
          ✓ {t('deleteData.done')}
        </p>
      )}
      {[start.error, confirm.error].map((e, i) =>
        e ? (
          <div key={i} className="mt-2">
            <ErrorBox error={e} />
          </div>
        ) : null,
      )}
    </Card>
  );
}
