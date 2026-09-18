import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Lang, makeT, TFn } from '@/lib/i18n';

type Theme = 'dark' | 'light';

interface AppContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  theme: Theme;
  toggleTheme: () => void;
  t: TFn;
  dir: 'rtl' | 'ltr';
  qrzCallsign: string | null;
  openQrz: (callsign: string) => void;
  closeQrz: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('scq_lang') as Lang) || 'he'
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('scq_theme') as Theme) || 'light'
  );
  const [qrzCallsign, setQrzCallsign] = useState<string | null>(null);

  const setLang = (l: Lang) => setLangState(l);
  const toggleLang = () => setLangState((p) => (p === 'he' ? 'en' : 'he'));
  const toggleTheme = () => setTheme((p) => (p === 'dark' ? 'light' : 'dark'));

  const openQrz = useCallback((callsign: string) => setQrzCallsign(callsign.toUpperCase()), []);
  const closeQrz = useCallback(() => setQrzCallsign(null), []);

  const dir: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('scq_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    localStorage.setItem('scq_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const t = useMemo(() => makeT(lang), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, theme, toggleTheme, t, dir, qrzCallsign, openQrz, closeQrz }),
    [lang, theme, t, dir, qrzCallsign, openQrz, closeQrz]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
