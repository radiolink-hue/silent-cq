export const ADMIN_CALLSIGN = '4X1DA';

export const PROXY_DEFAULT_BAND = '40m';
export const PROXY_DEFAULT_FREQUENCY = '7.165';
export const PROXY_DEFAULT_MODE = 'LSB';

/** Columns Active Users needs, including proxy flags. */
export const ACTIVE_CQ_SESSION_SELECT =
  'id, callsign, gridsquare, city, power, antenna, band, frequency, mode, created_at, comments, country, lat, lng, heard_count, active, allstar_source, is_proxy, proxy_added_by';

/** Band / freq / mode from a live net, or the off-net Silent CQ defaults. */
export function proxyRfDefaults(liveNet: {
  band?: string;
  frequency?: string;
  mode?: string;
} | null) {
  return {
    band: liveNet?.band?.trim() || PROXY_DEFAULT_BAND,
    frequency: liveNet?.frequency?.trim() || PROXY_DEFAULT_FREQUENCY,
    mode: liveNet?.mode?.trim() || PROXY_DEFAULT_MODE,
  };
}

export function withProxyRfFallback<T extends { band: string; frequency: string; mode: string }>(
  payload: T
): T {
  const fallback = proxyRfDefaults(null);
  return {
    ...payload,
    band: payload.band.trim() || fallback.band,
    frequency: payload.frequency.trim() || fallback.frequency,
    mode: payload.mode.trim() || fallback.mode,
  };
}

/** True when every live row for this callsign is a proxy (or there are none). */
export function canReplaceWithProxy(
  existing: { is_proxy?: boolean | null }[]
): boolean {
  return !existing.some((row) => row.is_proxy !== true);
}

function truthyProxyFlag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 't') return true;
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'f') return false;
  return null;
}

export function sessionIsProxy(row: {
  is_proxy?: unknown;
  isProxy?: unknown;
  proxy_added_by?: unknown;
  proxyAddedBy?: unknown;
}): boolean {
  const flagged = truthyProxyFlag(row.is_proxy ?? row.isProxy);
  if (flagged != null) return flagged;
  const by = row.proxy_added_by ?? row.proxyAddedBy;
  return typeof by === 'string' && by.trim().length > 0;
}

export function hydrateProxySession<T>(row: T): T & { is_proxy: boolean } {
  return {
    ...row,
    is_proxy: sessionIsProxy(row as Parameters<typeof sessionIsProxy>[0]),
  };
}
