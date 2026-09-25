import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ru } from './locales/ru';
import { kk } from './locales/kk';

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
  },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
