import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Each area contributes a module under src/i18n/gen/*.ts that exports one or
// more objects of the shape `{ en: Record<string,string>, de: Record<string,string> }`.
// They are auto-discovered here so new areas need no wiring.
type Bundle = { en: Record<string, string>; de: Record<string, string> };

const modules = import.meta.glob('./gen/*.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

const en: Record<string, string> = {};
const de: Record<string, string> = {};

for (const mod of Object.values(modules)) {
  for (const exported of Object.values(mod)) {
    const b = exported as Partial<Bundle>;
    if (b && typeof b === 'object' && b.en && b.de) {
      Object.assign(en, b.en);
      Object.assign(de, b.de);
    }
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kube-lens-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
