import { useTranslation } from 'react-i18next';
import { useIsFetching } from '@tanstack/react-query';
import dayjs from '../lib/dayjs';
import { useLastFetch } from './lastFetch';

/**
 * AGPL-3.0 §13: değiştirilmiş sürümü ağ üzerinden sunanlar kullanıcılara kaynak koduna
 * erişim sunmalıdır. Kendi çatalınızı yayınlıyorsanız VITE_SOURCE_URL ile kendi reponuzu gösterin.
 */
export const SOURCE_URL: string =
  import.meta.env.VITE_SOURCE_URL || 'https://github.com/mbahadirs/glukoz';

export function Footer() {
  const { t } = useTranslation();
  const last = useLastFetch();
  useIsFetching();
  return (
    <footer className="border-t border-border px-4 py-3 text-xs text-muted">
      <p>
        <strong>{t('disclaimer.title')}</strong> {t('disclaimer.medical')}
      </p>
      {last && (
        <p className="num mt-1">
          {t('footer.lastFetch', { time: dayjs(last).format('DD.MM.YYYY HH:mm') })}
        </p>
      )}
      <p className="mt-1">
        {t('footer.unaffiliated')}{' '}
        <a className="underline" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {t('footer.source')}
        </a>
      </p>
    </footer>
  );
}
