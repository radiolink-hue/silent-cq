import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isProfileComplete,
  loadOperatorProfile,
  needsCityPrompt,
  saveOperatorProfile,
} from './operatorProfile.ts';

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

describe('operator profile onboarding', () => {
  it('treats a full saved profile as complete so login can be skipped', () => {
    const profile = loadOperatorProfile(
      memoryStorage({
        scq_callsign: ' 4X1AA ',
        scq_gridsquare: 'KM72 ',
        scq_city: ' Tel Aviv ',
      })
    );
    assert.deepEqual(profile, { callsign: '4X1AA', gridsquare: 'KM72', city: 'Tel Aviv' });
    assert.equal(isProfileComplete(profile), true);
    assert.equal(needsCityPrompt(profile), false);
  });

  it('prompts only for city when callsign and grid are already saved', () => {
    const profile = loadOperatorProfile(
      memoryStorage({
        scq_callsign: '4X1AA',
        scq_gridsquare: 'KM72',
        scq_city: '   ',
      })
    );
    assert.equal(isProfileComplete(profile), false);
    assert.equal(needsCityPrompt(profile), true);
  });

  it('requires full login when callsign or grid is missing', () => {
    const profile = loadOperatorProfile(memoryStorage({ scq_city: 'Haifa' }));
    assert.equal(isProfileComplete(profile), false);
    assert.equal(needsCityPrompt(profile), false);
  });

  it('persists an updated city without wiping other fields', () => {
    const storage = memoryStorage({
      scq_callsign: '4X1AA',
      scq_gridsquare: 'KM72',
      scq_city: 'Tel Aviv',
    });
    saveOperatorProfile({ city: ' Eilat ' }, storage);
    assert.equal(storage.snapshot().scq_city, 'Eilat');
    assert.equal(storage.snapshot().scq_callsign, '4X1AA');
  });
});
