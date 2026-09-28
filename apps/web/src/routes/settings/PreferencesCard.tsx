import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@glukoz/shared';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/session';
import { useTheme, type ThemePref } from '../../hooks/theme';
import { useInstallPrompt, isIos, isStandalone } from '../../hooks/useInstallPrompt';
import { Card, ErrorBox } from '../../components/ui';
import i18n from '../../i18n';
import { logoutAndPurge } from '../../lib/logout';

type Prefs = Partial<Pick<MeResponse['user'], 'unit' | 'locale' | 'theme'>>;

export function PreferencesCard() {
  const { t } = useTranslation();
  const { me, setMe } = useSession();
  const theme = useTheme();
  const save = useMutation({
    mutationFn: (p: Prefs) => api<MeResponse>('/api/me/preferences', { method: 'PATCH', body: p }),
    onSuccess: (data) => {
      setMe(data);
      void i18n.changeLanguage(data.user.locale);
    },
  });
  if (!me) return null;
  const u = me.user;
  return (
    <Card title={t('settings.preferences')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="label">{t('settings.unit')}</span>
          <select
            className="input"
            value={u.unit}
            onChange={(e) => save.mutate({ unit: e.target.value as 'mgdl' | 'mmol' })}
          >
            <option value="mgdl">mg/dL</option>
            <option value="mmol">mmol/L</option>
          </select>
        </label>
        <label>
          <span className="label">{t('settings.language')}</span>
          <select
            className="input"
            value={u.locale}
            onChange={(e) => save.mutate({ locale: e.target.value })}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <span className="label">{t('settings.theme')}</span>
          <select
            className="input"
            value={theme.pref}
            onChange={(e) => {
              const v = e.target.value as ThemePref;
              theme.setPref(v);
              save.mutate({ theme: v });
            }}
          >
            {(['system', 'light', 'dark'] as const).map((v) => (
              <option key={v} value={v}>
                {t(`settings.themes.${v}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {save.error && (
        <div className="mt-2">
          <ErrorBox error={save.error} />
        </div>
      )}
    </Card>
  );
}

export function InstallCard() {
  const { t } = useTranslation();
  const { canInstall, install } = useInstallPrompt();
  if (isStandalone()) return null;
  return (
    <Card title={t('settings.install')}>
      {canInstall && (
        <button type="button" className="btn-primary" onClick={() => void install()}>
          {t('settings.installButton')}
        </button>
      )}
      {isIos() && <p className="text-sm">{t('settings.iosInstall')}</p>}
      {!canInstall && !isIos() && (
        <p className="text-sm text-muted">{t('settings.installUnavailable')}</p>
      )}
    </Card>
  );
}

export function AccountCard() {
  const { t } = useTranslation();
  const { me, setMe } = useSession();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    await logoutAndPurge();
    qc.clear();
    setMe(null);
  };
  return (
    <Card title={t('settings.account')}>
      <p className="text-sm">
        {me?.user.displayName} · {me?.user.email} · {t(`roles.${me?.user.role ?? 'VIEWER'}`)}
      </p>
      <button type="button" className="btn mt-3" disabled={busy} onClick={() => void logout()}>
        {t('auth.logout')}
      </button>
    </Card>
  );
}
