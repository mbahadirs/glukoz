import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LluAccountCreateResponse,
  LluAccountDto,
  LluAccountTestResponse,
} from '@glukoz/shared';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/session';
import { Card, ErrorBox, Loading } from '../../components/ui';

const KEY = ['llu-accounts'];

function AddAccount({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useSession();
  const [f, setF] = useState({ label: '', email: '', password: '' });
  const add = useMutation({
    mutationFn: () =>
      api<LluAccountCreateResponse>('/api/llu-accounts', { method: 'POST', body: f }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void refresh();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <form
      onSubmit={submit}
      className="mt-3 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3"
    >
      <p className="text-xs text-muted sm:col-span-3">{t('llu.followerNote')}</p>
      <label>
        <span className="label">{t('llu.label')}</span>
        <input
          className="input"
          required
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
        />
      </label>
      <label>
        <span className="label">{t('llu.email')}</span>
        <input
          className="input"
          type="email"
          required
          autoComplete="off"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
      </label>
      <label>
        <span className="label">{t('llu.password')}</span>
        <input
          className="input"
          type="password"
          required
          autoComplete="off"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
      </label>
      {add.error && (
        <div className="sm:col-span-3">
          <ErrorBox error={add.error} />
        </div>
      )}
      {add.data && (
        <p role="status" className="text-sm text-ok sm:col-span-3">
          ✓{' '}
          {t('llu.added', { count: add.data.patients.length, names: add.data.patients.join(', ') })}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" className="btn-primary" disabled={add.isPending}>
          {add.isPending ? t('llu.testing') : t('llu.addAndTest')}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t('common.close')}
        </button>
      </div>
    </form>
  );
}

function AccountRow({ a }: { a: LluAccountDto }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [result, setResult] = useState<string | null>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: KEY });
  const test = useMutation({
    mutationFn: () =>
      api<LluAccountTestResponse>(`/api/llu-accounts/${a.id}/test`, { method: 'POST', body: {} }),
    onSuccess: (r) => {
      setResult(
        r.ok
          ? t('llu.testOk', { count: r.patients })
          : `${r.errorCode}: ${t(`errors.${r.errorCode}`, { defaultValue: r.message ?? '' })}`,
      );
      invalidate();
    },
  });
  const resume = useMutation({
    mutationFn: () => api(`/api/llu-accounts/${a.id}/resume`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (confirmLabel: string) =>
      api(`/api/llu-accounts/${a.id}`, { method: 'DELETE', body: { confirmLabel } }),
    onSuccess: invalidate,
  });
  const onDelete = () => {
    const typed = window.prompt(t('llu.confirmDelete', { label: a.label }));
    if (typed !== null) remove.mutate(typed);
  };
  return (
    <li className="py-3 text-sm" data-testid="llu-account-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{a.label}</span>
        <span className="num text-muted">{a.emailMasked}</span>
        <span
          className={`chip min-h-6 text-xs ${a.status === 'active' ? 'text-ok' : 'text-very-high'}`}
        >
          {a.status === 'active' ? '●' : '⚠'} {t(`llu.status.${a.status}`)}
        </span>
        <span className="text-xs text-muted">
          {t('llu.region')}: {a.region ?? '–'} · {t('llu.patients', { count: a.patientCount })}
        </span>
      </div>
      {a.lastError && <p className="mt-1 text-xs text-danger-text">{a.lastError}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          className="btn min-h-8 py-1"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          {t('llu.test')}
        </button>
        {a.status !== 'active' && (
          <button type="button" className="btn min-h-8 py-1" onClick={() => resume.mutate()}>
            {t('llu.resume')}
          </button>
        )}
        <button type="button" className="btn-danger min-h-8 py-1" onClick={onDelete}>
          {t('common.delete')}
        </button>
      </div>
      {result && (
        <p role="status" className="mt-1 text-xs">
          {result}
        </p>
      )}
      {[test.error, resume.error, remove.error].map((e, i) =>
        e ? <ErrorBox key={i} error={e} /> : null,
      )}
    </li>
  );
}

export function LluAdmin() {
  const { t } = useTranslation();
  const accounts = useQuery({
    queryKey: KEY,
    queryFn: () => api<LluAccountDto[]>('/api/llu-accounts'),
  });
  const [adding, setAdding] = useState(false);
  return (
    <Card
      title={t('llu.title')}
      actions={
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + {t('llu.add')}
        </button>
      }
    >
      {accounts.isLoading && <Loading />}
      {accounts.error && <ErrorBox error={accounts.error} />}
      {accounts.data?.length === 0 && <p className="text-sm text-muted">{t('llu.none')}</p>}
      <ul className="divide-y divide-border">
        {accounts.data?.map((a) => (
          <AccountRow key={a.id} a={a} />
        ))}
      </ul>
      {adding && <AddAccount onDone={() => setAdding(false)} />}
    </Card>
  );
}
