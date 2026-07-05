import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './locales';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      nl: { translation: nl },
    },
    fallbackLng: DEFAULT_LOCALE,
    // Only ever resolve to a language we actually ship; map regional tags
    // (fr-BE → fr, nl-BE → nl) onto their primary subtag.
    supportedLngs: [...SUPPORTED_LOCALES],
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    defaultNS: 'translation',
    detection: {
      // personal_lang cookie = explicit user preference (Settings / switcher);
      // it wins over the browser. `navigator` is the browser/OS language, used
      // for first-time visitors with no saved choice.
      order: ['cookie', 'localStorage', 'navigator'],
      lookupCookie: 'personal_lang',
      lookupLocalStorage: 'personal_lang',
      caches: [], // we write personal_lang manually so workspace sync doesn't pollute it
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
