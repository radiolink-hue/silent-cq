import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReplaceWithProxy, hydrateProxySession, proxyRfDefaults, sessionIsProxy, withProxyRfFallback } from './adminProxy.ts';

describe('canReplaceWithProxy', () => {
  it('allows a first proxy post', () => {
    assert.equal(canReplaceWithProxy([]), true);
  });

  it('allows replacing an existing proxy', () => {
    assert.equal(canReplaceWithProxy([{ is_proxy: true }]), true);
  });

  it('blocks when the station already self-reported', () => {
    assert.equal(canReplaceWithProxy([{ is_proxy: false }]), false);
    assert.equal(canReplaceWithProxy([{ is_proxy: true }, { is_proxy: false }]), false);
    assert.equal(canReplaceWithProxy([{}]), false);
  });
});

describe('proxyRfDefaults', () => {
  it('uses the live net when one is on the air', () => {
    assert.deepEqual(
      proxyRfDefaults({ band: '2m', frequency: '145.775', mode: 'FM' }),
      { band: '2m', frequency: '145.775', mode: 'FM' }
    );
  });

  it('defaults to 40m / 7.165 / LSB when no net is active', () => {
    assert.deepEqual(proxyRfDefaults(null), {
      band: '40m',
      frequency: '7.165',
      mode: 'LSB',
    });
  });

  it('fills blank RF fields so a proxy post can go out without a net', () => {
    const filled = withProxyRfFallback({ band: '', frequency: '', mode: '', callsign: '4X1AA' });
    assert.equal(filled.band, '40m');
    assert.equal(filled.frequency, '7.165');
    assert.equal(filled.mode, 'LSB');
    assert.equal(filled.callsign, '4X1AA');
  });
});

describe('sessionIsProxy', () => {
  it('reads is_proxy, isProxy, or proxy_added_by', () => {
    assert.equal(sessionIsProxy({ is_proxy: true }), true);
    assert.equal(sessionIsProxy({ isProxy: true }), true);
    assert.equal(sessionIsProxy({ is_proxy: 'true' }), true);
    assert.equal(sessionIsProxy({ proxy_added_by: '4X1DA' }), true);
    assert.equal(sessionIsProxy({ is_proxy: false }), false);
    assert.equal(hydrateProxySession({ callsign: '4X1AA', isProxy: true }).is_proxy, true);
  });
});
