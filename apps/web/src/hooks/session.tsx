import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GlucoseUnit, MeResponse, PatientSummary } from '@glukoz/shared';
import { api, AUTH_EVENT, CONSENT_EVENT, isApiError, setCsrfToken } from '../lib/api';
import { qk } from '../lib/queries';
import { purgeCachedHealthData } from '../lib/logout';
import i18n from '../i18n';

export interface Session {
  me: MeResponse | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsConsent: boolean;
  unit: GlucoseUnit;
  patients: PatientSummary[];
  isAdmin: boolean;
  setMe: (me: MeResponse | null) => void;
  refresh: () => Promise<unknown>;
}

const SessionContext = createContext<Session | null>(null);

async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await api<MeResponse>('/api/auth/me');
  } catch (e) {
    if (isApiError(e) && e.status === 401) {
      // Oturum yok/süresi doldu: cihazdaki önbelleğe alınmış sağlık verisini sil.
      await purgeCachedHealthData();
      return null;
    }
    throw e;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 5 * 60_000, retry: 1 });
  const me = query.data ?? undefined;

  useEffect(() => {
    setCsrfToken(me?.csrfToken ?? null);
    if (me?.user.locale && i18n.language !== me.user.locale)
      void i18n.changeLanguage(me.user.locale);
  }, [me]);

  useEffect(() => {
    const onUnauthorized = () => qc.setQueryData(qk.me, null);
    const onConsent = () => void qc.invalidateQueries({ queryKey: qk.me });
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => {
      window.removeEventListener(AUTH_EVENT, onUnauthorized);
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [qc]);

  const setMe = useCallback((next: MeResponse | null) => qc.setQueryData(qk.me, next), [qc]);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: qk.me }), [qc]);

  const value = useMemo<Session>(
    () => ({
      me,
      isLoading: query.isLoading,
      isAuthenticated: !!me,
      needsConsent: !!me && me.user.consentVersion !== me.requiredConsentVersion,
      unit: me?.user.unit ?? 'mgdl',
      patients: me?.patients ?? [],
      isAdmin: me?.user.role === 'ADMIN',
      setMe,
      refresh,
    }),
    [me, query.isLoading, setMe, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider eksik');
  return ctx;
}
