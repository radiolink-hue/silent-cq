import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dashboardDefaultsPending, persistDashboardDefaults } from './dashboardDefaults.ts';

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    snapshot: () => data,
  };
}

describe('dashboard defaults', () => {
  it('applies English and dark mode the first time onboarding is passed', () => {
    const storage = memoryStorage({ scq_lang: 'he', scq_theme: 'light' });
    assert.equal(dashboardDefaultsPending(storage), true);
    persistDashboardDefaults(storage);
    assert.equal(storage.snapshot().scq_lang, 'en');
    assert.equal(storage.snapshot().scq_theme, 'dark');
    assert.equal(dashboardDefaultsPending(storage), false);
  });

  it('leaves a later manual language or theme choice in place', () => {
    const storage = memoryStorage({
      scq_dashboard_defaults: '1',
      scq_lang: 'he',
      scq_theme: 'light',
    });
    assert.equal(dashboardDefaultsPending(storage), false);
    assert.equal(storage.snapshot().scq_lang, 'he');
    assert.equal(storage.snapshot().scq_theme, 'light');
  });
});
