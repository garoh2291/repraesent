import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import de from './locales/de.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'de',
    defaultNS: 'translation',
    detection: {
      // personal_lang cookie = explicit user preference; wins over workspace default
      order: ['cookie', 'localStorage'],
      lookupCookie: 'personal_lang',
      lookupLocalStorage: 'personal_lang',
      caches: [], // we write personal_lang manually so workspace sync doesn't pollute it
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
