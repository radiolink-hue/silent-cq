import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CqSession, NetParticipant } from '../types.ts';
import {
  filterParticipantsToLiveCq,
  isLiveSilentCqPost,
  liveSilentCqCallsigns,
  participantIdsForCallsign,
  planNetParticipantSync,
  shouldSyncNetSignalReport,
} from './cqPresence.ts';

const now = Date.parse('2026-09-19T12:00:00.000Z');

function session(overrides: Partial<CqSession>): CqSession {
  return {
    id: 's1',
    callsign: '4X1AA',
    gridsquare: 'KM72',
    band: '40m',
    mode: 'LSB',
    frequency: '7.165',
    power: '100W',
    antenna: 'Dipole',
    city: 'Tel Aviv',
    country: 'Israel',
    comments: '',
    lat: null,
    lng: null,
    heard_count: 0,
    active: true,
    created_at: new Date(now - 5 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe('isLiveSilentCqPost', () => {
  it('accepts a recent published Silent CQ', () => {
    assert.equal(isLiveSilentCqPost(session({}), now), true);
  });

  it('rejects login-only stubs with no operating parameters', () => {
    assert.equal(
      isLiveSilentCqPost(
        session({ band: '', mode: '', frequency: '', allstar_source: '' }),
        now
      ),
      false
    );
  });

  it('rejects expired sessions even if still marked active', () => {
    assert.equal(
      isLiveSilentCqPost(
        session({ created_at: new Date(now - 91 * 60 * 1000).toISOString() }),
        now
      ),
      false
    );
  });

  it('accepts AllStar-sourced check-ins without a frequency', () => {
    assert.equal(
      isLiveSilentCqPost(
        session({ frequency: '', allstar_source: 'allmon2:48552' }),
        now
      ),
      true
    );
  });
});

describe('planNetParticipantSync', () => {
  it('does not add login-only users and removes them from an existing net', () => {
    const live = session({ callsign: '4X1CQ', id: 'live' });
    const stub = session({
      id: 'stub',
      callsign: '4X1LOGIN',
      band: '',
      mode: '',
      frequency: '',
    });
    const plan = planNetParticipantSync(
      'net-1',
      [live, stub],
      [
        { id: 'p-login', callsign: '4X1LOGIN' },
        { id: 'p-gone', callsign: '4X1GONE' },
      ],
      now
    );

    assert.deepEqual(
      plan.toInsert.map((row) => row.callsign),
      ['4X1CQ']
    );
    assert.deepEqual(plan.toUpdate, []);
    assert.deepEqual(plan.toRemoveIds.sort(), ['p-gone', 'p-login'].sort());
  });

  it('updates an existing check-in with the latest CQ data instead of inserting a duplicate', () => {
    const live = session({
      callsign: '4x1aa',
      gridsquare: 'KM73',
      city: 'Eilat',
      antenna: 'Yagi',
      power: '400',
    });
    const plan = planNetParticipantSync(
      'net-1',
      [live],
      [{ id: 'p-old', callsign: '4X1AA' }],
      now
    );

    assert.deepEqual(plan.toInsert, []);
    assert.deepEqual(plan.toRemoveIds, []);
    assert.equal(plan.toUpdate.length, 1);
    assert.equal(plan.toUpdate[0].id, 'p-old');
    assert.equal(plan.toUpdate[0].callsign, '4X1AA');
    assert.equal(plan.toUpdate[0].grid, 'KM73');
    assert.equal(plan.toUpdate[0].city, 'Eilat');
    assert.equal(plan.toUpdate[0].antenna, 'Yagi');
    assert.equal(plan.toUpdate[0].power, '400');
    assert.equal(plan.toUpdate[0].is_proxy, false);
  });

  it('copies proxy flags from a live admin-posted session', () => {
    const live = session({ callsign: '4X1BB', is_proxy: true, proxy_added_by: '4X1DA' });
    const plan = planNetParticipantSync('net-1', [live], [], now);
    assert.equal(plan.toInsert[0].is_proxy, true);
    assert.equal(plan.toInsert[0].proxy_added_by, '4X1DA');
  });

  it('keeps one row and drops extras when the same callsign is already listed twice', () => {
    const live = session({ callsign: '4X1AA', city: 'Haifa' });
    const plan = planNetParticipantSync(
      'net-1',
      [live],
      [
        { id: 'p-a', callsign: '4x1aa' },
        { id: 'p-b', callsign: '4X1AA' },
      ],
      now
    );

    assert.deepEqual(plan.toInsert, []);
    assert.equal(plan.toUpdate[0].id, 'p-a');
    assert.deepEqual(plan.toRemoveIds, ['p-b']);
  });

  it('matches an existing participant by callsign regardless of case', () => {
    assert.deepEqual(
      participantIdsForCallsign(
        [
          { id: 'p1', callsign: '4x1aa' },
          { id: 'p2', callsign: '4X1DA' },
        ],
        '4X1AA'
      ),
      ['p1']
    );
  });
});

describe('signal matrix visibility', () => {
  it('omits login-only stations from the matrix axes', () => {
    const participants: NetParticipant[] = [
      {
        id: '1',
        net_id: 'n1',
        callsign: '4X1CQ',
        grid: 'KM72',
        city: 'Tel Aviv',
        antenna: 'Dipole',
        power: '100W',
        created_at: new Date(now).toISOString(),
      },
      {
        id: '2',
        net_id: 'n1',
        callsign: '4X1LOGIN',
        grid: 'KM72',
        city: 'Haifa',
        antenna: '',
        power: '',
        created_at: new Date(now).toISOString(),
      },
    ];
    const live = liveSilentCqCallsigns([
      session({ callsign: '4X1CQ' }),
      session({ callsign: '4X1LOGIN', band: '', mode: '', frequency: '' }),
    ], now);
    const visible = filterParticipantsToLiveCq(participants, live);
    const matrixCallsigns = visible.map((p) => p.callsign.toUpperCase()).sort();

    assert.deepEqual(matrixCallsigns, ['4X1CQ']);
    assert.equal(shouldSyncNetSignalReport('4X1CQ', '4X1LOGIN', live), false);
    assert.equal(shouldSyncNetSignalReport('4X1CQ', '4X1BB', liveSilentCqCallsigns([
      session({ callsign: '4X1CQ' }),
      session({ callsign: '4X1BB' }),
    ], now)), true);
  });
});
