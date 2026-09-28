import { useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AlertStrip, OfflineStrip } from './StatusStrips';
import { Footer } from './Footer';
import { UpdatePrompt } from './UpdatePrompt';

interface NavItem {
  to: string;
  key: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { to: '/', key: 'live', icon: '◉' },
  { to: '/gunluk', key: 'daily', icon: '▦' },
  { to: '/raporlar', key: 'reports', icon: '▤' },
  { to: '/kayitlar', key: 'records', icon: '✎' },
  { to: '/sensorler', key: 'sensors', icon: '◌' },
  { to: '/uyarilar', key: 'alerts', icon: '⚑' },
  { to: '/ayarlar', key: 'settings', icon: '⚙' },
];
const MOBILE_MAIN = ['live', 'daily', 'reports', 'alerts'];

const keepPatient = (prev: Record<string, unknown>) => ({
  patient: prev.patient as string | undefined,
});

function NavLink({ item, compact }: { item: NavItem; compact?: boolean }) {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = item.to === '/' ? path === '/' : path.startsWith(item.to);
  return (
    <Link
      to={item.to}
      search={keepPatient as never}
      aria-current={active ? 'page' : undefined}
      className={
        compact
          ? `flex min-h-14 flex-1 flex-col items-center justify-center text-xs ${active ? 'font-bold text-accent' : 'text-muted'}`
          : `flex min-h-10 items-center gap-3 rounded-md px-3 text-sm ${active ? 'bg-accent font-semibold text-accent-contrast' : 'text-text hover:bg-surface-2'}`
      }
    >
      <span aria-hidden className={compact ? 'text-lg leading-none' : ''}>
        {item.icon}
      </span>
      {t(`nav.${item.key}`)}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
        {t('nav.skip')}
      </a>
      <aside className="no-print hidden w-56 shrink-0 border-r border-border bg-surface p-3 lg:block">
        <p className="mb-4 px-3 text-lg font-bold text-accent">{t('app.name')}</p>
        <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
          {NAV.map((i) => (
            <NavLink key={i.key} item={i} />
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <div className="no-print sticky top-0 z-10">
          <UpdatePrompt />
          <OfflineStrip />
          <AlertStrip />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4">
          {children}
        </main>
        <Footer />
      </div>
      <nav
        aria-label={t('nav.main')}
        className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg lg:hidden"
      >
        {more && (
          <div className="flex flex-col gap-1 border-b border-border p-2">
            {NAV.filter((i) => !MOBILE_MAIN.includes(i.key)).map((i) => (
              <div key={i.key} onClick={() => setMore(false)}>
                <NavLink item={i} />
              </div>
            ))}
          </div>
        )}
        <div className="flex">
          {NAV.filter((i) => MOBILE_MAIN.includes(i.key)).map((i) => (
            <NavLink key={i.key} item={i} compact />
          ))}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            className="flex min-h-14 flex-1 flex-col items-center justify-center text-xs text-muted"
          >
            <span aria-hidden className="text-lg leading-none">
              ⋯
            </span>
            {t('nav.more')}
          </button>
        </div>
      </nav>
    </div>
  );
}
