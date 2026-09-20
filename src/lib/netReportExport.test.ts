import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildNetSessionCsv,
  csvEscape,
  csvFileName,
  formatParticipantSignalReports,
  netMatchesExportSelection,
  uniqueCsvFileName,
} from './netReportExport.ts';

describe('net report CSV export', () => {
  it('escapes commas and quotes', () => {
    assert.equal(csvEscape('Tel Aviv'), 'Tel Aviv');
    assert.equal(csvEscape('a,b'), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  });

  it('names files NetName_YYYY-MM-DD.csv with underscores', () => {
    assert.equal(
      csvFileName('Daily Roundtable Net', '2026-09-20'),
      'Daily_Roundtable_Net_2026-09-20.csv'
    );
  });

  it('disambiguates two sessions with the same name and date', () => {
    const used = new Set<string>();
    assert.equal(uniqueCsvFileName('TEST NET', '2026-09-18', used), 'TEST_NET_2026-09-18.csv');
    assert.equal(uniqueCsvFileName('TEST NET', '2026-09-18', used), 'TEST_NET_2026-09-18_2.csv');
  });

  it('lists heard-by reports as semicolon-separated callsign→RST', () => {
    const text = formatParticipantSignalReports('4x1aa', [
      { id: '1', net_id: 'n', tx_callsign: '4X1AA', rx_callsign: '4X1DA', rst_report: '5-9', created_at: '' },
      { id: '2', net_id: 'n', tx_callsign: '4X1AA', rx_callsign: '4X1DM', rst_report: '5-9+10', created_at: '' },
      { id: '3', net_id: 'n', tx_callsign: '4X1DA', rx_callsign: '4X1AA', rst_report: '5-7', created_at: '' },
    ]);
    assert.equal(text, '4X1DA→5-9; 4X1DM→5-9+10');
  });

  it('includes every session when All Nets is selected', () => {
    assert.equal(netMatchesExportSelection('TEST NET', true, new Set()), true);
  });

  it('matches Gal and Hagal names to the Hagal Hameshudar filter', () => {
    const gal = new Set(['gal'] as const);
    assert.equal(netMatchesExportSelection('Hagal Hameshudar', false, gal), true);
    assert.equal(netMatchesExportSelection('Gal Hameshudar Net', false, gal), true);
    assert.equal(netMatchesExportSelection('Daily Roundtable Net', false, gal), false);
  });

  it('builds a UTF-8 CSV with the required columns', () => {
    const csv = buildNetSessionCsv(
      { name: 'Daily Roundtable Net', net_date: '2026-09-20', starts_at: '2026-09-20T15:00:00.000Z', created_at: '' },
      [
        {
          id: 'p',
          net_id: 'n',
          callsign: '4X1AA',
          grid: 'KM72',
          city: 'Haifa',
          antenna: 'Dipole',
          power: '100',
          created_at: '',
        },
      ],
      [
        {
          id: 'r',
          net_id: 'n',
          tx_callsign: '4X1AA',
          rx_callsign: '4X1DA',
          rst_report: '5-9',
          created_at: '',
        },
      ]
    );
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('Date,Time,Callsign,Grid,City,Power,Antenna,Signal_Reports'));
    assert.ok(csv.includes('2026-09-20'));
    assert.ok(csv.includes('4X1AA'));
    assert.ok(csv.includes('4X1DA→5-9'));
  });
});
