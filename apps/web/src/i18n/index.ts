import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './tr.json';
import en from './en.json';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/tr';

function initialLanguage(): string {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'tr';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'tr';
}

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Başlangıç dili (init olayı kaçırılmış olabilir) + sonraki değişiklikler.
dayjs.locale(i18n.language === 'en' ? 'en' : 'tr');

i18n.on('languageChanged', (lng) => {
  dayjs.locale(lng === 'en' ? 'en' : 'tr');
  document.documentElement.lang = lng;
});

export default i18n;
