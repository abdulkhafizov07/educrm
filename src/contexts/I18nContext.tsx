'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';

type Messages = Record<string, unknown>;

interface I18nCtx {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

function getNestedValue(obj: Messages, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function I18nProvider({ children, messages }: {
  children: ReactNode;
  messages: Record<Locale, Messages>;
}) {
  // Always start from 'en' so server and first client render match (avoids hydration mismatch).
  // The stored/browser preference is applied right after mount.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('locale') as Locale | null;
      if (saved && ['en', 'ru', 'uz'].includes(saved)) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
        return;
      }
      const browser = navigator.language.split('-')[0];
      if (['ru', 'uz'].includes(browser)) {
        setLocaleState(browser as Locale);
        document.documentElement.lang = browser;
      }
    } catch {}
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let value = getNestedValue(messages[locale], key) ?? getNestedValue(messages['en'], key) ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  }, [locale, messages]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
