import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Lang, makeT, TFn } from '@/lib/i18n';
import { dashboardDefaultsPending, DEFAULT_APP_LANG, DEFAULT_APP_THEME, persistDashboardDefaults } from '@/lib/dashboardDefaults';

type Theme = 'dark' | 'light';

interface AppContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  theme: Theme;
  toggleTheme: () => void;
  t: TFn;
  dir: 'rtl' | 'ltr';
  applyDashboardDefaults: (force?: boolean) => void;
  qrzCallsign: string | null;
  openQrz: (callsign: string) => void;
  closeQrz: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('scq_lang');
    return stored === 'he' || stored === 'en' ? stored : DEFAULT_APP_LANG;
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('scq_theme');
    return stored === 'dark' || stored === 'light' ? stored : DEFAULT_APP_THEME;
  });
  const [qrzCallsign, setQrzCallsign] = useState<string | null>(null);

  const setLang = (l: Lang) => setLangState(l);
  const toggleLang = () => setLangState((p) => (p === 'he' ? 'en' : 'he'));
  const toggleTheme = () => setTheme((p) => (p === 'dark' ? 'light' : 'dark'));

  const applyDashboardDefaults = useCallback((force = false) => {
    if (!force && !dashboardDefaultsPending(localStorage)) return;
    persistDashboardDefaults(localStorage);
    setLangState(DEFAULT_APP_LANG);
    setTheme(DEFAULT_APP_THEME);
  }, []);
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
    () => ({
      lang,
      setLang,
      toggleLang,
      theme,
      toggleTheme,
      t,
      dir,
      applyDashboardDefaults,
      qrzCallsign,
      openQrz,
      closeQrz,
    }),
    [lang, theme, t, dir, applyDashboardDefaults, qrzCallsign, openQrz, closeQrz]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
