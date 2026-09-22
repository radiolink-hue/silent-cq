import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLookupCsv, searchLookupTable } from './lookupTable.ts';

const csv = `callsign,name,grid,city,power,antenna
4X1AA,Alice,KM72ab,Tel Aviv,100,Dipole
4X1AB,Bob,KM72cd,Haifa,,
4X1DA,Dan,KM71aa,Modiin,400,Yagi
`;

describe('lookup table CSV', () => {
  it('skips the header and maps columns', () => {
    const rows = parseLookupCsv(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], {
      callsign: '4X1AA',
      name: 'Alice',
      gridSquare: 'KM72ab',
      city: 'Tel Aviv',
      maxPower: '100',
      antenna: 'Dipole',
    });
    assert.equal(rows[1].maxPower, '');
    assert.equal(rows[1].antenna, '');
  });

  it('filters callsigns by a partial query', () => {
    const rows = parseLookupCsv(csv);
    assert.deepEqual(
      searchLookupTable(rows, '4x1a').map((e) => e.callsign),
      ['4X1AA', '4X1AB']
    );
    assert.equal(searchLookupTable(rows, '4X1DA').length, 1);
    assert.equal(searchLookupTable(rows, 'ZZ').length, 0);
  });
});
