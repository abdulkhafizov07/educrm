export type Locale = 'en' | 'ru' | 'uz';

export const locales: Locale[] = ['en', 'ru', 'uz'];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  uz: "O'zbek",
};
