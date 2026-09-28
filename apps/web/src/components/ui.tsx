import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../lib/api';

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <p role="status" className="p-4 text-muted">
      {label ?? t('common.loading')}
    </p>
  );
}

/** Hata mesajı: ne oldu + ne yapılmalı. */
export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const code = isApiError(error) ? error.code : 'UNKNOWN';
  const known = t(`errors.${code}`, { defaultValue: '' });
  const message = known || (error instanceof Error ? error.message : t('errors.UNKNOWN'));
  return (
    <div
      role="alert"
      className="rounded-md border border-low bg-danger-bg p-3 text-sm text-danger-text"
    >
      <p className="font-semibold">{message}</p>
      <p>{t(`errors.hint.${code}`, { defaultValue: t('errors.hint.default') })}</p>
    </div>
  );
}

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`card print-avoid ${className ?? ''}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-bold">{children}</h1>
      {actions}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-4 text-center text-sm text-muted">{children}</p>;
}
