import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AlertRuleDto } from '@glukoz/shared';
import { api } from '../../lib/api';
import { fmtGlucose } from '../../lib/format';
import { patientPath, qk } from '../../lib/queries';
import { useSession } from '../../hooks/session';
import { ErrorBox } from '../../components/ui';

type Draft = Omit<AlertRuleDto, 'id'> & { id?: string };

const THRESHOLD_KINDS = new Set(['urgent_low', 'low', 'high', 'rapid_fall']);

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v);
}

export function RuleEditor({
  patientId,
  rules,
  canEdit,
}: {
  patientId: string;
  rules: AlertRuleDto[];
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { unit } = useSession();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft[]>(rules);
  useEffect(() => setDrafts(rules), [rules]);

  const save = useMutation({
    mutationFn: (list: Draft[]) =>
      api<AlertRuleDto[]>(`${patientPath(patientId)}/alert-rules`, {
        method: 'PUT',
        body: { rules: list.map(({ id: _id, ...r }) => r) },
      }),
    onSuccess: (data) => qc.setQueryData(qk.rules(patientId), data),
  });

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(drafts);
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-3">
        {drafts.map((r, i) => (
          <div key={r.kind} className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={r.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
              />
              {t(`alertKinds.${r.kind}`)}
            </label>
            <p className="mt-1 text-xs text-muted">{t(`alertKinds.${r.kind}Desc`)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {THRESHOLD_KINDS.has(r.kind) && (
                <label className="text-sm">
                  <span className="label">{t('alerts.threshold')}</span>
                  <input
                    className="input num"
                    inputMode="numeric"
                    value={r.thresholdMgdl ?? ''}
                    onChange={(e) => update(i, { thresholdMgdl: numOrNull(e.target.value) })}
                  />
                  {unit === 'mmol' && r.thresholdMgdl !== null && (
                    <span className="text-xs text-muted">
                      ≈ {fmtGlucose(r.thresholdMgdl, 'mmol', i18n.language)} mmol/L
                    </span>
                  )}
                </label>
              )}
              <label className="text-sm">
                <span className="label">{t('alerts.sustain')}</span>
                <input
                  className="input num"
                  inputMode="numeric"
                  value={r.sustainMin}
                  onChange={(e) => update(i, { sustainMin: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="text-sm">
                <span className="label">{t('alerts.cooldown')}</span>
                <input
                  className="input num"
                  inputMode="numeric"
                  value={r.cooldownMin}
                  onChange={(e) => update(i, { cooldownMin: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="text-sm">
                <span className="label">{t('alerts.quietStart')}</span>
                <input
                  type="time"
                  className="input num"
                  value={r.quietStart ?? ''}
                  disabled={r.kind === 'urgent_low'}
                  onChange={(e) => update(i, { quietStart: e.target.value || null })}
                />
              </label>
              <label className="text-sm">
                <span className="label">{t('alerts.quietEnd')}</span>
                <input
                  type="time"
                  className="input num"
                  value={r.quietEnd ?? ''}
                  disabled={r.kind === 'urgent_low'}
                  onChange={(e) => update(i, { quietEnd: e.target.value || null })}
                />
              </label>
            </div>
            {r.kind === 'urgent_low' && (
              <p className="mt-1 text-xs text-muted">{t('alerts.urgentIgnoresQuiet')}</p>
            )}
          </div>
        ))}
        {save.error && <ErrorBox error={save.error} />}
        {save.isSuccess && (
          <p role="status" className="text-sm text-ok">
            ✓ {t('common.saved')}
          </p>
        )}
        {canEdit && (
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {t('common.save')}
          </button>
        )}
      </fieldset>
    </form>
  );
}
