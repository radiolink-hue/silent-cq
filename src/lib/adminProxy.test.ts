import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReplaceWithProxy } from './adminProxy.ts';

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
