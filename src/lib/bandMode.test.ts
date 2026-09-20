import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultModeForBand } from '../types.ts';

describe('defaultModeForBand', () => {
  it('selects LSB on the lower HF bands', () => {
    for (const band of ['160m', '80m', '60m', '40m']) {
      assert.equal(defaultModeForBand(band), 'LSB');
    }
  });

  it('selects FM on VHF/UHF bands', () => {
    for (const band of ['2m', '70cm', '23cm']) {
      assert.equal(defaultModeForBand(band), 'FM');
    }
  });

  it('selects USB on remaining HF bands', () => {
    for (const band of ['30m', '20m', '17m', '15m', '12m', '10m', '6m']) {
      assert.equal(defaultModeForBand(band), 'USB');
    }
  });
});
