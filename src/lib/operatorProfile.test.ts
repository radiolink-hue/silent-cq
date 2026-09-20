import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_OPERATOR_POWER,
  isProfileComplete,
  loadOperatorProfile,
  needsCityPrompt,
  parseOperatorPower,
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
        scq_power: '250',
      })
    );
    assert.deepEqual(profile, {
      callsign: '4X1AA',
      gridsquare: 'KM72',
      city: 'Tel Aviv',
      power: 250,
    });
    assert.equal(isProfileComplete(profile), true);
    assert.equal(needsCityPrompt(profile), false);
  });

  it('defaults power to 100 when it has not been saved yet', () => {
    const profile = loadOperatorProfile(
      memoryStorage({
        scq_callsign: '4X1AA',
        scq_gridsquare: 'KM72',
        scq_city: 'Tel Aviv',
      })
    );
    assert.equal(profile.power, DEFAULT_OPERATOR_POWER);
    assert.equal(isProfileComplete(profile), true);
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
      scq_power: '100',
    });
    saveOperatorProfile({ city: ' Eilat ' }, storage);
    assert.equal(storage.snapshot().scq_city, 'Eilat');
    assert.equal(storage.snapshot().scq_callsign, '4X1AA');
    assert.equal(storage.snapshot().scq_power, '100');
  });

  it('persists power as an integer string', () => {
    const storage = memoryStorage({
      scq_callsign: '4X1AA',
      scq_gridsquare: 'KM72',
      scq_city: 'Tel Aviv',
    });
    saveOperatorProfile({ power: 1500 }, storage);
    assert.equal(storage.snapshot().scq_power, '1500');
  });
});

describe('parseOperatorPower', () => {
  it('accepts integers from 1 to 1500', () => {
    assert.equal(parseOperatorPower('1'), 1);
    assert.equal(parseOperatorPower('100'), 100);
    assert.equal(parseOperatorPower(1500), 1500);
  });

  it('rejects values outside the allowed range or non-integers', () => {
    assert.equal(parseOperatorPower('0'), null);
    assert.equal(parseOperatorPower('1501'), null);
    assert.equal(parseOperatorPower('100.5'), null);
    assert.equal(parseOperatorPower('100W'), null);
    assert.equal(parseOperatorPower(''), null);
  });
});
