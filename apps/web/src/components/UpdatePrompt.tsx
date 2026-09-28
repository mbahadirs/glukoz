import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Yeni SW hazır olduğunda "Güncelleme var — yenile" (registerType: prompt). */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!needRefresh) return null;
  return (
    <div role="status" className="no-print flex items-center gap-3 bg-surface-2 px-4 py-2 text-sm">
      <span>{t('pwa.updateAvailable')}</span>
      <button
        type="button"
        className="btn-primary min-h-8 py-1"
        onClick={() => void updateServiceWorker(true)}
      >
        {t('pwa.reload')}
      </button>
      <button type="button" className="btn min-h-8 py-1" onClick={() => setNeedRefresh(false)}>
        {t('common.later')}
      </button>
    </div>
  );
}
