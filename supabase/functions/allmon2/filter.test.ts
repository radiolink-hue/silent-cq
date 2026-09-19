import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAllmon2, shouldDropAllstarNode } from './filter.ts';

describe('shouldDropAllstarNode', () => {
  it('drops the AllStar echo node 1999 even with a placeholder callsign', () => {
    assert.equal(shouldDropAllstarNode('1999', 'N/A', 'N/A'), true);
    assert.equal(shouldDropAllstarNode('1999', '4X1DA Echo', '4X1DA'), true);
  });

  it('drops the AllStar hub Cloud Node 48552 even with a real callsign', () => {
    assert.equal(shouldDropAllstarNode('48552', '4X1KS Cloud Node', '4X1KS'), true);
    assert.equal(shouldDropAllstarNode('48552', '4X1DA Tel Aviv', '4X1DA'), true);
  });

  it('drops N/A callsigns and Not in Database labels on any node', () => {
    assert.equal(shouldDropAllstarNode('43622', 'N/A', 'N/A'), true);
    assert.equal(shouldDropAllstarNode('2000', 'Not in Database', 'Not'), true);
    assert.equal(shouldDropAllstarNode('2000', '4X1DA Not in Database', '4X1DA'), true);
  });

  it('keeps real linked stations', () => {
    assert.equal(shouldDropAllstarNode('43622', '4X1KS Hashmonaim', '4X1KS'), false);
  });
});

describe('parseAllmon2', () => {
  it('silently omits node 1999 and never lists it as transmitting', () => {
    const html = `
      <table>
        <tr style="background-color:green">
          <td>1999</td>
          <td>N/A Not in Database</td>
        </tr>
        <tr>
          <td>43622</td>
          <td>4X1KS Hashmonaim</td>
        </tr>
        <tr>
          <td>2001</td>
          <td>Not in Database</td>
        </tr>
      </table>
    `;
    const parsed = parseAllmon2(html);
    assert.deepEqual(
      parsed.nodes.map((n) => n.node),
      ['43622']
    );
    assert.equal(parsed.transmittingNode, null);
    assert.equal(parsed.nodes.some((n) => n.callsign.toUpperCase() === 'N/A'), false);
  });

  it('never lists hub node 48552 as a live station or transmitter', () => {
    const html = `
      <table>
        <tr style="background-color:green">
          <td>48552</td>
          <td>4X1KS Cloud Node</td>
        </tr>
        <tr>
          <td>429730</td>
          <td>4X1DA Modiin</td>
        </tr>
      </table>
    `;
    const parsed = parseAllmon2(html);
    assert.equal(parsed.nodes.some((n) => n.node === '48552'), false);
    assert.equal(parsed.transmittingNode, null);
    assert.deepEqual(
      parsed.nodes.map((n) => n.node),
      ['429730']
    );
  });
});
