export const ADMIN_CALLSIGN = '4X1DA';

/** True when every live row for this callsign is a proxy (or there are none). */
export function canReplaceWithProxy(
  existing: { is_proxy?: boolean | null }[]
): boolean {
  return !existing.some((row) => row.is_proxy !== true);
}
