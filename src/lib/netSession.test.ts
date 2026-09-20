import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSameNetSessionName, pickExistingNetSession } from './netSession.ts';

describe('net session identity', () => {
  it('treats the same name as one type regardless of case and extra spaces', () => {
    assert.equal(isSameNetSessionName('Daily Roundtable Net', 'daily  roundtable net'), true);
    assert.equal(isSameNetSessionName('Shabbat Morning Net', 'TEST NET'), false);
  });

  it('reuses the oldest matching session instead of creating another', () => {
    const existing = pickExistingNetSession(
      [
        { id: 'b', name: 'Daily Roundtable Net', created_at: '2026-09-18T18:10:00.000Z' },
        { id: 'a', name: 'daily roundtable net', created_at: '2026-09-18T18:00:00.000Z' },
        { id: 'c', name: 'TEST NET', created_at: '2026-09-18T18:00:00.000Z' },
      ],
      'Daily Roundtable Net'
    );
    assert.equal(existing?.id, 'a');
  });

  it('returns undefined when that net type is not on the day yet', () => {
    assert.equal(
      pickExistingNetSession(
        [{ id: 't', name: 'TEST NET', created_at: '2026-09-18T18:00:00.000Z' }],
        'Daily Roundtable Net'
      ),
      undefined
    );
  });
});
