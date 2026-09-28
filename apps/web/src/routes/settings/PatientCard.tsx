import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PatientSummary } from '@glukoz/shared';
import { api } from '../../lib/api';
import { patientPath, qk } from '../../lib/queries';
import { useSession } from '../../hooks/session';
import { Card, ErrorBox } from '../../components/ui';

const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['Europe/Istanbul', 'UTC'];

const PRESETS = {
  general: { targetLow: 70, targetHigh: 180 },
  pregnancy: { targetLow: 63, targetHigh: 140 },
  olderHighRisk: { targetLow: 70, targetHigh: 180 },
} as const;

export function PatientCard({ patient }: { patient: PatientSummary }) {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const qc = useQueryClient();
  const toForm = (p: PatientSummary) => ({
    displayName: p.displayName ?? '',
    targetLow: String(p.targetLow),
    targetHigh: String(p.targetHigh),
    timezone: p.timezone,
    sensorLifeDays: String(p.sensorLifeDays),
  });
  const [form, setForm] = useState(() => toForm(patient));
  useEffect(() => setForm(toForm(patient)), [patient]);

  const save = useMutation({
    mutationFn: () =>
      api<PatientSummary>(patientPath(patient.id), {
        method: 'PATCH',
        body: {
          displayName: form.displayName.trim() || null,
          targetLow: Number(form.targetLow),
          targetHigh: Number(form.targetHigh),
          timezone: form.timezone,
          sensorLifeDays: Number(form.sensorLifeDays),
        },
      }),
    onSuccess: () => {
      void refresh();
      void qc.invalidateQueries({ queryKey: qk.patients });
      void qc.invalidateQueries({ queryKey: ['report'] });
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card title={t('settings.patient', { name: patient.name })}>
      <form onSubmit={submit}>
        <fieldset disabled={!patient.canEdit} className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">{t('settings.displayName')}</span>
            <input
              className="input"
              maxLength={100}
              value={form.displayName}
              placeholder={`${patient.firstName} ${patient.lastName}`}
              onChange={set('displayName')}
            />
          </label>
          <label>
            <span className="label">{t('settings.timezone')}</span>
            <select className="input" value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{t('settings.targetLow')}</span>
            <input
              className="input num"
              inputMode="numeric"
              value={form.targetLow}
              onChange={set('targetLow')}
            />
          </label>
          <label>
            <span className="label">{t('settings.targetHigh')}</span>
            <input
              className="input num"
              inputMode="numeric"
              value={form.targetHigh}
              onChange={set('targetHigh')}
            />
          </label>
          <div className="sm:col-span-2">
            <span className="label">{t('settings.presets')}</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      targetLow: String(PRESETS[k].targetLow),
                      targetHigh: String(PRESETS[k].targetHigh),
                    }))
                  }
                >
                  {t(`settings.presetNames.${k}`)}
                </button>
              ))}
            </div>
            {patient.lluTargetLow !== null && (
              <p className="mt-1 text-xs text-muted">
                {t('settings.lluTargets', {
                  low: patient.lluTargetLow,
                  high: patient.lluTargetHigh,
                })}
              </p>
            )}
          </div>
          <label>
            <span className="label">{t('settings.sensorLife')}</span>
            <input
              className="input num"
              inputMode="numeric"
              value={form.sensorLifeDays}
              onChange={set('sensorLifeDays')}
            />
            <span className="text-xs text-muted">{t('settings.sensorLifeHint')}</span>
          </label>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {t('common.save')}
            </button>
            {save.isSuccess && (
              <span role="status" className="ml-3 text-sm text-ok">
                ✓ {t('common.saved')}
              </span>
            )}
          </div>
        </fieldset>
        {save.error && (
          <div className="mt-2">
            <ErrorBox error={save.error} />
          </div>
        )}
      </form>
    </Card>
  );
}
