import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { SetupStatusResponse } from '@glukoz/shared';
import { api } from '../lib/api';
import { qk } from '../lib/queries';
import { useSession } from '../hooks/session';
import { AppShell } from '../components/AppShell';
import { Loading } from '../components/ui';
import { ConsentPage, LoginPage, SetupPage } from './AuthPages';
import { LivePage } from './LivePage';

const PUBLIC = ['/login', '/setup'];

// Canlı sayfa dışındaki rotalar ayrı parçalara bölünür (ilk yükleme hızı)
const DailyPage = lazyRouteComponent(() => import('./DailyPage'), 'DailyPage');
const ReportsPage = lazyRouteComponent(() => import('./reports/ReportsPage'), 'ReportsPage');
const PrintPage = lazyRouteComponent(() => import('./reports/PrintPage'), 'PrintPage');
const RecordsPage = lazyRouteComponent(() => import('./RecordsPage'), 'RecordsPage');
const SensorsPage = lazyRouteComponent(() => import('./SensorsPage'), 'SensorsPage');
const AlertsPage = lazyRouteComponent(() => import('./AlertsPage'), 'AlertsPage');
const SettingsPage = lazyRouteComponent(() => import('./settings/SettingsPage'), 'SettingsPage');

function RootGate() {
  const session = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const setup = useQuery({
    queryKey: qk.setup,
    queryFn: () => api<SetupStatusResponse>('/api/setup/status'),
    staleTime: Infinity,
  });
  const isPublic = PUBLIC.includes(path);

  if (session.isLoading || setup.isLoading) return <Loading />;
  if (!session.isAuthenticated) {
    if (setup.data?.needsSetup && path !== '/setup') return <Navigate to="/setup" />;
    if (!setup.data?.needsSetup && !isPublic) return <Navigate to="/login" />;
    if (!setup.data?.needsSetup && path === '/setup') return <Navigate to="/login" />;
    return <Outlet />;
  }
  if (isPublic) return <Navigate to="/" />;
  if (session.needsConsent) return <ConsentPage />;
  if (path.startsWith('/raporlar/yazdir')) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) =>
  v === undefined || v === '' ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined;

export interface PatientSearch {
  patient?: string;
}
export interface LiveSearch extends PatientSearch {
  hours?: number;
  note?: number;
}
export interface DailySearch extends PatientSearch {
  date?: string;
  compare?: string;
}
export interface ReportSearch extends PatientSearch {
  days?: number;
  from?: string;
  to?: string;
}

const rootRoute = createRootRoute({ component: RootGate });
const withPatient = (s: Record<string, unknown>): PatientSearch => ({ patient: str(s.patient) });

const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/setup', component: SetupPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: LivePage,
    validateSearch: (s): LiveSearch => ({
      ...withPatient(s),
      hours: num(s.hours),
      note: num(s.note),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/gunluk',
    component: DailyPage,
    validateSearch: (s): DailySearch => ({
      ...withPatient(s),
      date: str(s.date),
      compare: str(s.compare),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/raporlar',
    component: ReportsPage,
    validateSearch: (s): ReportSearch => ({
      ...withPatient(s),
      days: num(s.days),
      from: str(s.from),
      to: str(s.to),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/raporlar/yazdir',
    component: PrintPage,
    validateSearch: (s): ReportSearch => ({
      ...withPatient(s),
      days: num(s.days),
      from: str(s.from),
      to: str(s.to),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/kayitlar',
    component: RecordsPage,
    validateSearch: withPatient,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/sensorler',
    component: SensorsPage,
    validateSearch: withPatient,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/uyarilar',
    component: AlertsPage,
    validateSearch: withPatient,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/ayarlar',
    component: SettingsPage,
    validateSearch: withPatient,
  }),
];

export const router = createRouter({
  routeTree: rootRoute.addChildren(routes),
  defaultPreload: false,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
