export const ADMIN_CALLSIGN = '4X1DA';

export const PROXY_DEFAULT_BAND = '40m';
export const PROXY_DEFAULT_FREQUENCY = '7.165';
export const PROXY_DEFAULT_MODE = 'LSB';

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

export type ProxyDuplicate =
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'proxy'; postedBy: string };

/** Warn instead of posting when the callsign is already in the active session. */
export function findProxyDuplicate(
  existing: { is_proxy?: boolean | null; proxy_added_by?: string | null }[]
): ProxyDuplicate {
  if (existing.length === 0) return { kind: 'none' };
  const self = existing.find((row) => row.is_proxy !== true);
  if (self) return { kind: 'self' };
  const postedBy =
    existing.find((row) => row.proxy_added_by?.trim())?.proxy_added_by?.trim() ||
    ADMIN_CALLSIGN;
  return { kind: 'proxy', postedBy };
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
