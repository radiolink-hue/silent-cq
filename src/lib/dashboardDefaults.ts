export const DASHBOARD_DEFAULTS_KEY = 'scq_dashboard_defaults';
export const DEFAULT_APP_LANG = 'en' as const;
export const DEFAULT_APP_THEME = 'dark' as const;

/** English and dark mode, once, after onboarding is completed or skipped. */
export function dashboardDefaultsPending(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(DASHBOARD_DEFAULTS_KEY) !== '1';
}

export function persistDashboardDefaults(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(DASHBOARD_DEFAULTS_KEY, '1');
  storage.setItem('scq_lang', DEFAULT_APP_LANG);
  storage.setItem('scq_theme', DEFAULT_APP_THEME);
}
