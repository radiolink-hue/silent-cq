import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseSpotToOverwrite, oneActiveSpotPerCallsign } from './spotDedup.ts';

describe('active spot dedup', () => {
  it('keeps the newest row when the same callsign is listed twice', () => {
    const rows = oneActiveSpotPerCallsign([
      { id: 'old', callsign: '4x1zz', created_at: '2026-11-06T10:00:00.000Z', frequency: '14.200' },
      { id: 'new', callsign: '4X1ZZ', created_at: '2026-11-06T12:00:00.000Z', frequency: '7.165' },
      { id: 'other', callsign: '4X1AA', created_at: '2026-11-06T11:00:00.000Z', frequency: '7.100' },
    ]);
    assert.deepEqual(rows.map((row) => row.id), ['new', 'other']);
  });

  it('overwrites an admin proxy row instead of opening a second spot', () => {
    const plan = chooseSpotToOverwrite(
      [
        { id: 'proxy', callsign: '4X1ZZ', created_at: '2026-11-06T09:00:00.000Z', is_proxy: true },
        { id: 'older', callsign: '4x1zz', created_at: '2026-11-06T08:00:00.000Z', is_proxy: false },
      ],
      '4X1ZZ'
    );
    assert.equal(plan.keep?.id, 'proxy');
    assert.deepEqual(plan.retireIds, ['older']);
  });

  it('inserts when the callsign has no active spot', () => {
    const plan = chooseSpotToOverwrite(
      [{ id: 'other', callsign: '4X1AA', created_at: '2026-11-06T09:00:00.000Z' }],
      '4X1ZZ'
    );
    assert.equal(plan.keep, null);
    assert.deepEqual(plan.retireIds, []);
  });
});
