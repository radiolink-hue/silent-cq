import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLiveNet,
  netWindowFromClock,
  planRecurringRetimes,
  recurringWindowFromClock,
  resolveLiveNet,
  windowOnJerusalemDate,
} from './liveNetSchedule.ts';

describe('live net detection (Asia/Jerusalem)', () => {
  it('opens the daily roundtable at 17:25 Israel in winter and summer', () => {
    assert.equal(getLiveNet(new Date('2026-01-15T15:24:00.000Z')), null);
    assert.equal(getLiveNet(new Date('2026-01-15T15:25:00.000Z'))?.id, 'roundtable');
    assert.equal(getLiveNet(new Date('2026-01-15T17:15:00.000Z'))?.id, 'roundtable');
    assert.equal(getLiveNet(new Date('2026-01-15T17:16:00.000Z')), null);
    assert.equal(getLiveNet(new Date('2026-07-15T14:24:00.000Z')), null);
    assert.equal(getLiveNet(new Date('2026-07-15T14:25:00.000Z'))?.id, 'roundtable');
    assert.equal(getLiveNet(new Date('2026-07-15T16:15:00.000Z'))?.id, 'roundtable');
    assert.equal(getLiveNet(new Date('2026-07-15T16:16:00.000Z')), null);
  });

  it('uses 100 W and dipole for the roundtable', () => {
    const net = getLiveNet(new Date('2026-01-15T16:30:00.000Z'));
    assert.equal(net?.power, '100');
    assert.equal(net?.antenna, 'Dipole');
    assert.equal(net?.frequency, '7.165');
    assert.equal(net?.nameHe, 'השולחן העגול');
  });

  it('detects Hagal Hameshudar on Tuesday evenings', () => {
    const net = getLiveNet(new Date('2026-01-13T17:25:00.000Z'));
    assert.equal(net?.id, 'gal');
    assert.equal(net?.name, 'Hagal Hameshudar');
    assert.equal(net?.antenna, 'Vertical');
    assert.equal(net?.power, '');
    assert.equal(getLiveNet(new Date('2026-01-13T17:24:00.000Z')), null);
  });

  it('detects Shabbat morning net from 08:00 Israel', () => {
    assert.equal(getLiveNet(new Date('2026-01-17T05:59:00.000Z')), null);
    const net = getLiveNet(new Date('2026-01-17T06:00:00.000Z'));
    assert.equal(net?.id, 'shabbat');
    assert.equal(net?.frequency, '7.130');
    assert.equal(net?.power, '100');
    assert.equal(getLiveNet(new Date('2026-01-17T10:00:00.000Z'))?.id, 'shabbat');
    assert.equal(getLiveNet(new Date('2026-01-17T10:01:00.000Z')), null);
  });

  it('follows a saved Daily Roundtable window instead of 17:25', () => {
    const saved = {
      name: 'Daily Roundtable Net',
      starts_at: '2026-01-15T14:25:00.000Z',
      ends_at: '2026-01-15T17:15:00.000Z',
    };
    assert.equal(getLiveNet(new Date('2026-01-15T15:00:00.000Z')), null);
    assert.equal(resolveLiveNet(new Date('2026-01-15T14:24:00.000Z'), [saved]), null);
    assert.equal(resolveLiveNet(new Date('2026-01-15T15:00:00.000Z'), [saved])?.id, 'roundtable');
    assert.equal(resolveLiveNet(new Date('2026-01-15T17:15:00.000Z'), [saved])?.id, 'roundtable');
    assert.equal(resolveLiveNet(new Date('2026-01-15T17:16:00.000Z'), [saved]), null);
  });

  it('hides the built-in window when today\'s saved start is later', () => {
    const saved = {
      name: 'Daily Roundtable Net',
      starts_at: '2026-01-15T16:30:00.000Z',
      ends_at: '2026-01-15T17:15:00.000Z',
    };
    assert.equal(getLiveNet(new Date('2026-01-15T16:00:00.000Z'))?.id, 'roundtable');
    assert.equal(resolveLiveNet(new Date('2026-01-15T16:00:00.000Z'), [saved]), null);
    assert.equal(resolveLiveNet(new Date('2026-01-15T16:30:00.000Z'), [saved])?.id, 'roundtable');
  });

  it('keeps other nets on the built-in clock when only the roundtable row changed', () => {
    const saved = {
      name: 'Daily Roundtable Net',
      starts_at: '2026-01-13T14:25:00.000Z',
      ends_at: '2026-01-13T17:15:00.000Z',
    };
    assert.equal(resolveLiveNet(new Date('2026-01-13T17:25:00.000Z'), [saved])?.id, 'gal');
  });

  it('stores an edited 16:25 start on the session date in both offsets', () => {
    const winter = netWindowFromClock(
      { starts_at: '2026-01-15T15:25:00.000Z', net_date: '2026-01-15' },
      '16:25',
      '19:15'
    );
    assert.equal(winter?.startsAt, '2026-01-15T14:25:00.000Z');
    assert.equal(winter?.endsAt, '2026-01-15T17:15:00.000Z');

    const summer = netWindowFromClock(
      { starts_at: '2026-07-15T14:25:00.000Z', net_date: '2026-07-15' },
      '16:25',
      '19:15'
    );
    assert.equal(summer?.startsAt, '2026-07-15T13:25:00.000Z');
    assert.equal(summer?.endsAt, '2026-07-15T16:15:00.000Z');
    assert.equal(netWindowFromClock({ starts_at: '2026-01-15T15:25:00.000Z' }, '19:15', '17:25'), null);
  });

  it('uses a recurring 16:25 template even when today\'s row is still 17:25', () => {
    const saved = {
      name: 'Daily Roundtable Net',
      starts_at: '2026-01-15T15:25:00.000Z',
      ends_at: '2026-01-15T17:15:00.000Z',
    };
    const recurring = [{ scheduleId: 'roundtable' as const, startHour: 16, startMinute: 25, endHour: 19, endMinute: 15 }];
    assert.equal(resolveLiveNet(new Date('2026-01-15T14:30:00.000Z'), [saved]), null);
    assert.equal(resolveLiveNet(new Date('2026-01-15T14:24:00.000Z'), [saved], recurring), null);
    const live = resolveLiveNet(new Date('2026-01-15T14:30:00.000Z'), [saved], recurring);
    assert.equal(live?.id, 'roundtable');
    assert.equal(live?.startHour, 16);
    assert.equal(live?.startMinute, 25);
    assert.equal(resolveLiveNet(new Date('2026-01-15T17:15:00.000Z'), [saved], recurring)?.id, 'roundtable');
    assert.equal(resolveLiveNet(new Date('2026-01-15T17:16:00.000Z'), [saved], recurring), null);
  });

  it('lets a later recurring start hide a stale earlier row', () => {
    const saved = {
      name: 'Daily Roundtable Net',
      starts_at: '2026-01-15T15:25:00.000Z',
      ends_at: '2026-01-15T17:15:00.000Z',
    };
    const recurring = [{ scheduleId: 'roundtable' as const, startHour: 18, startMinute: 0, endHour: 19, endMinute: 15 }];
    assert.equal(resolveLiveNet(new Date('2026-01-15T15:30:00.000Z'), [saved])?.id, 'roundtable');
    assert.equal(resolveLiveNet(new Date('2026-01-15T15:30:00.000Z'), [saved], recurring), null);
    assert.equal(resolveLiveNet(new Date('2026-01-15T16:00:00.000Z'), [saved], recurring)?.startHour, 18);
  });

  it('applies 16:25 on a future Jerusalem date in both offsets', () => {
    const clock = { startHour: 16, startMinute: 25, endHour: 19, endMinute: 15 };
    const winter = windowOnJerusalemDate(2026, 11, 2, clock);
    assert.equal(winter?.startsAt, '2026-11-02T14:25:00.000Z');
    assert.equal(winter?.endsAt, '2026-11-02T17:15:00.000Z');
    const summer = windowOnJerusalemDate(2026, 7, 16, clock);
    assert.equal(summer?.startsAt, '2026-07-16T13:25:00.000Z');
    assert.equal(summer?.endsAt, '2026-07-16T16:15:00.000Z');
    assert.equal(recurringWindowFromClock('roundtable', '19:15', '16:25'), null);
  });

  it('retimes today and later sessions and leaves 28/10/2026 unchanged', () => {
    const clock = { scheduleId: 'roundtable' as const, startHour: 16, startMinute: 25, endHour: 19, endMinute: 15 };
    const rows = [
      { id: 'past', name: 'Daily Roundtable Net', starts_at: '2026-10-28T15:25:00.000Z', net_date: '2026-10-28' },
      { id: 'today', name: 'Daily Roundtable Net', starts_at: '2026-10-31T15:25:00.000Z', net_date: '2026-10-31' },
      { id: 'future', name: 'Daily Roundtable Net', starts_at: '2026-11-01T15:25:00.000Z', net_date: '2026-11-01' },
      { id: 'shabbat', name: 'Shabbat Morning Net', starts_at: '2026-10-31T06:00:00.000Z', net_date: '2026-10-31' },
    ];
    const planned = planRecurringRetimes(rows, 'roundtable', clock, '2026-10-31');
    assert.deepEqual(planned.map((row) => row.id), ['today', 'future']);
    assert.equal(planned[0].startsAt, '2026-10-31T14:25:00.000Z');
    assert.equal(planned[0].endsAt, '2026-10-31T17:15:00.000Z');
    assert.equal(planned[1].startsAt, '2026-11-01T14:25:00.000Z');
  });

  it('detects Israel AllStar Link Net on Thursday with blank power', () => {
    const net = getLiveNet(new Date('2026-01-15T17:55:00.000Z'));
    assert.equal(net?.id, 'allstar');
    assert.equal(net?.frequency, '430.9');
    assert.equal(net?.antenna, 'Vertical');
    assert.equal(net?.power, '');
    assert.equal(net?.nameHe, 'Israel AllStar Link Net');
    assert.equal(getLiveNet(new Date('2026-01-15T19:00:00.000Z'))?.id, 'allstar');
    assert.equal(getLiveNet(new Date('2026-01-15T19:01:00.000Z')), null);
  });
});
