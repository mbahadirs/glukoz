import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@glukoz/shared';
import { api } from '../lib/api';
import { qk } from '../lib/queries';
import { useSession } from '../hooks/session';
import { ErrorBox } from '../components/ui';
import { logoutAndPurge } from '../lib/logout';

function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
      <p className="mb-2 text-center text-lg font-bold text-accent">{t('app.name')}</p>
      <h1 className="mb-6 text-center text-2xl font-bold">{title}</h1>
      {children}
      <p className="mt-8 text-center text-xs text-muted">{t('disclaimer.medical')}</p>
    </main>
  );
}

function Field(props: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? 'text'}
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        className="input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <p className="mt-1 text-xs text-muted">{props.hint}</p>}
    </div>
  );
}

function useAuthSubmit(path: string) {
  const { setMe } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const me = await api<MeResponse>(path, { method: 'POST', body });
      setMe(me);
      qc.setQueryData(qk.setup, { needsSetup: false });
      await navigate({ to: '/' });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return { submit, error, busy };
}

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit, error, busy } = useAuthSubmit('/api/auth/login');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit({ email, password });
  };
  return (
    <AuthLayout title={t('auth.loginTitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          id="email"
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {error ? <ErrorBox error={error} /> : null}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {t('auth.login')}
        </button>
      </form>
    </AuthLayout>
  );
}

export function SetupPage() {
  const { t } = useTranslation();
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit, error, busy } = useAuthSubmit('/api/setup');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit({ displayName, email, password });
  };
  return (
    <AuthLayout title={t('auth.setupTitle')}>
      <p className="mb-4 text-sm text-muted">{t('auth.setupIntro')}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          id="displayName"
          label={t('auth.displayName')}
          autoComplete="name"
          value={displayName}
          onChange={setName}
        />
        <Field
          id="email"
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={password}
          onChange={setPassword}
          hint={t('auth.passwordHint')}
        />
        {error ? <ErrorBox error={error} /> : null}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {t('auth.createAdmin')}
        </button>
      </form>
    </AuthLayout>
  );
}

export function ConsentPage() {
  const { t } = useTranslation();
  const { me, setMe } = useSession();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const accept = async () => {
    try {
      setMe(
        await api<MeResponse>('/api/me/consent', {
          method: 'POST',
          body: { version: me?.requiredConsentVersion },
        }),
      );
    } catch (e) {
      setError(e);
    }
  };
  const logout = async () => {
    await logoutAndPurge();
    setMe(null);
  };
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">{t('consent.title')}</h1>
      <div className="card space-y-2 text-sm">
        <p>{t('consent.p1')}</p>
        <p>{t('consent.p2')}</p>
        <p>{t('consent.p3')}</p>
        <p className="text-muted">
          {t('consent.version', { version: me?.requiredConsentVersion })}
        </p>
      </div>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>{t('consent.accept')}</span>
      </label>
      {error ? <ErrorBox error={error} /> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!checked}
          onClick={() => void accept()}
        >
          {t('consent.continue')}
        </button>
        <button type="button" className="btn" onClick={() => void logout()}>
          {t('auth.logout')}
        </button>
      </div>
    </main>
  );
}
