import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLiveNet } from './liveNetSchedule.ts';

describe('live net detection (Asia/Jerusalem)', () => {
  it('opens the daily roundtable at 18:25 Israel, not 18:00', () => {
    assert.equal(getLiveNet(new Date('2026-01-15T16:00:00.000Z')), null);
    assert.equal(getLiveNet(new Date('2026-01-15T16:24:00.000Z')), null);
    assert.equal(getLiveNet(new Date('2026-01-15T16:25:00.000Z'))?.id, 'roundtable');
    assert.equal(getLiveNet(new Date('2026-07-15T15:25:00.000Z'))?.id, 'roundtable');
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
