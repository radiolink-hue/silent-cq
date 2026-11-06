/** One visible Silent CQ row per callsign. The newest created_at wins. */

export function normalizeSpotCallsign(callsign: string): string {
  return callsign.trim().toUpperCase();
}

export function oneActiveSpotPerCallsign<T extends { id: string; callsign: string; created_at: string }>(
  rows: T[]
): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = normalizeSpotCallsign(row.callsign);
    if (!key) continue;
    const current = best.get(key);
    if (!current || row.created_at > current.created_at || (row.created_at === current.created_at && row.id > current.id)) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
  );
}

export function chooseSpotToOverwrite<T extends { id: string; callsign: string; created_at?: string }>(
  rows: T[],
  callsign: string
): { keep: T | null; retireIds: string[] } {
  const key = normalizeSpotCallsign(callsign);
  const matches = rows.filter((row) => normalizeSpotCallsign(row.callsign) === key);
  if (matches.length === 0) return { keep: null, retireIds: [] };
  const ranked = [...matches].sort(
    (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)
  );
  return { keep: ranked[0], retireIds: ranked.slice(1).map((row) => row.id) };
}
