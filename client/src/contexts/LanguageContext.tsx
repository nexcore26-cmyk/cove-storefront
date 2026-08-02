import React, { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'en' | 'ar';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isRTL: boolean;
  t: (en: string, ar?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'cove_locale';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'ar') return stored;
    } catch {}
    return 'en';
  });

  const isRTL = locale === 'ar';

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  };

  // Apply RTL and lang attribute to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', locale);
    html.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    // Toggle RTL class for Tailwind RTL utilities
    if (isRTL) {
      html.classList.add('rtl');
    } else {
      html.classList.remove('rtl');
    }
  }, [locale, isRTL]);

  // Simple translation helper: returns Arabic string if locale is 'ar' and ar is provided
  const t = (en: string, ar?: string): string => {
    if (locale === 'ar' && ar) return ar;
    return en;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
