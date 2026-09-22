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
