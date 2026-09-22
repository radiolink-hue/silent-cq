const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1mEpDxap4ZaroZX25p8PuNjsc0sgAF3pscd3X3_fl4Xk/export?format=csv';

export interface LookupEntry {
  callsign: string;
  name: string;
  gridSquare: string;
  city: string;
  maxPower: string;
  antenna: string;
}

function parseLine(line: string): LookupEntry {
  const cols = line.split(',');
  return {
    callsign: cols[0]?.trim().toUpperCase() ?? '',
    name: cols[1]?.trim() ?? '',
    gridSquare: cols[2]?.trim() ?? '',
    city: cols[3]?.trim() ?? '',
    maxPower: cols[4]?.trim() ?? '',
    antenna: cols[5]?.trim() ?? '',
  };
}

export function parseLookupCsv(text: string): LookupEntry[] {
  const lines = text.trim().split('\n').slice(1);
  return lines.map(parseLine).filter((e) => e.callsign);
}

export async function fetchLookupTable(): Promise<LookupEntry[]> {
  const response = await fetch(SHEET_CSV_URL);
  const text = await response.text();
  return parseLookupCsv(text);
}

export function searchLookupTable(
  entries: LookupEntry[],
  partial: string
): LookupEntry[] {
  const query = partial.toUpperCase();
  if (!query) return [];
  return entries.filter((e) => e.callsign.includes(query));
}
