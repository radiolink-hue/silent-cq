/** One net session per name per calendar date (case-insensitive, trimmed). */

export function normalizeNetName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function isSameNetSessionName(a: string, b: string): boolean {
  return normalizeNetName(a) === normalizeNetName(b);
}

export function pickExistingNetSession<T extends { id: string; name: string; created_at?: string }>(
  nets: T[],
  name: string
): T | undefined {
  const matches = nets.filter((n) => isSameNetSessionName(n.name, name));
  if (matches.length === 0) return undefined;
  return [...matches].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  })[0];
}
