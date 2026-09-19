import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActiveNet, getScheduleUtcWindow } from './nets.ts';
import { formatJerusalemTime, zonedWallTimeToUtc } from './netTime.ts';

describe('net UTC schedule', () => {
  it('maps 18:00 Israel to 16:00 UTC in winter (UTC+2)', () => {
    const utc = zonedWallTimeToUtc('Asia/Jerusalem', 2026, 1, 15, 18, 0);
    assert.equal(utc.toISOString(), '2026-01-15T16:00:00.000Z');
    assert.equal(formatJerusalemTime(utc), '18:00');
  });

  it('maps 18:00 Israel to 15:00 UTC in summer (UTC+3)', () => {
    const utc = zonedWallTimeToUtc('Asia/Jerusalem', 2026, 7, 15, 18, 0);
    assert.equal(utc.toISOString(), '2026-07-15T15:00:00.000Z');
    assert.equal(formatJerusalemTime(utc), '18:00');
  });

  it('opens the daily roundtable from the UTC instant, not a fake +3 offset', () => {
    assert.equal(getActiveNet(new Date('2026-01-15T15:59:00.000Z')), null);
    assert.equal(getActiveNet(new Date('2026-01-15T16:00:00.000Z'))?.id, 'roundtable');
    assert.equal(getActiveNet(new Date('2026-07-15T14:59:00.000Z')), null);
    assert.equal(getActiveNet(new Date('2026-07-15T15:00:00.000Z'))?.id, 'roundtable');
    assert.equal(getActiveNet(new Date('2026-07-15T16:15:00.000Z'))?.id, 'roundtable');
    assert.equal(getActiveNet(new Date('2026-07-15T16:16:00.000Z')), null);
  });

  it('stores AllStar window bounds as UTC instants', () => {
    const summer = getScheduleUtcWindow(
      getActiveNet(new Date('2026-07-16T16:55:00.000Z'))!,
      new Date('2026-07-16T16:55:00.000Z')
    );
    assert.equal(summer.startsAt.toISOString(), '2026-07-16T16:55:00.000Z');
    assert.equal(summer.endsAt.toISOString(), '2026-07-16T18:00:00.000Z');

    const winterThu = new Date('2026-01-15T17:55:00.000Z');
    assert.equal(getActiveNet(winterThu)?.id, 'allstar');
    const winter = getScheduleUtcWindow(getActiveNet(winterThu)!, winterThu);
    assert.equal(winter.startsAt.toISOString(), '2026-01-15T17:55:00.000Z');
  });
});
