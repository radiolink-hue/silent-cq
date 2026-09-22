import type { CqSession, NetParticipant } from '../types.ts';

/** Same lifetime as the live Silent CQ board. */
export const CQ_SESSION_TTL_MS = 90 * 60 * 1000;

export function isExpiredCqSession(
  session: { created_at: string },
  now: number = Date.now()
): boolean {
  return now - new Date(session.created_at).getTime() > CQ_SESSION_TTL_MS;
}

/**
 * A station is visible to nets only if it has a live published Silent CQ
 * (or an AllStar-sourced check-in). Callsign/grid/city from login alone is not enough.
 */
export function isLiveSilentCqPost(
  session: {
    active?: boolean;
    created_at: string;
    callsign: string;
    band?: string | null;
    mode?: string | null;
    frequency?: string | null;
    allstar_source?: string | null;
  },
  now: number = Date.now()
): boolean {
  if (session.active === false) return false;
  if (!session.callsign?.trim()) return false;
  if (isExpiredCqSession(session, now)) return false;

  const band = (session.band ?? '').trim();
  const mode = (session.mode ?? '').trim();
  const frequency = (session.frequency ?? '').trim();
  const allstar = (session.allstar_source ?? '').trim();

  return Boolean(frequency || allstar || (band && mode));
}

export function liveSilentCqCallsigns(
  sessions: Parameters<typeof isLiveSilentCqPost>[0][],
  now: number = Date.now()
): Set<string> {
  const callsigns = new Set<string>();
  for (const session of sessions) {
    if (!isLiveSilentCqPost(session, now)) continue;
    callsigns.add(session.callsign.trim().toUpperCase());
  }
  return callsigns;
}

export function filterParticipantsToLiveCq(
  participants: NetParticipant[],
  liveCallsigns: Set<string>
): NetParticipant[] {
  return participants.filter((p) => liveCallsigns.has(p.callsign.toUpperCase()));
}

export interface NetParticipantFields {
  callsign: string;
  grid: string;
  city: string;
  antenna: string;
  power: string;
  is_proxy: boolean;
  proxy_added_by: string | null;
}

export interface NetParticipantSyncPlan {
  toInsert: ({ net_id: string } & NetParticipantFields)[];
  toUpdate: ({ id: string } & NetParticipantFields)[];
  toRemoveIds: string[];
}

function fieldsFromSession(session: CqSession): NetParticipantFields {
  return {
    callsign: session.callsign.trim().toUpperCase(),
    grid: session.gridsquare || '',
    city: session.city || '',
    antenna: session.antenna || '',
    power: session.power || '',
    is_proxy: session.is_proxy === true,
    proxy_added_by: session.is_proxy === true ? (session.proxy_added_by || null) : null,
  };
}

export function planNetParticipantSync(
  netId: string,
  sessions: CqSession[],
  existing: { id: string; callsign: string }[],
  now: number = Date.now()
): NetParticipantSyncPlan {
  const liveSessions = sessions.filter((s) => isLiveSilentCqPost(s, now));

  const groups = new Map<string, { id: string; callsign: string }[]>();
  const toRemoveIds: string[] = [];

  for (const row of existing) {
    const key = row.callsign.trim().toUpperCase();
    if (!key) {
      toRemoveIds.push(row.id);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const handled = new Set<string>();
  const toInsert: NetParticipantSyncPlan['toInsert'] = [];
  const toUpdate: NetParticipantSyncPlan['toUpdate'] = [];

  for (const session of liveSessions) {
    const fields = fieldsFromSession(session);
    if (!fields.callsign || handled.has(fields.callsign)) continue;
    handled.add(fields.callsign);

    const rows = groups.get(fields.callsign) ?? [];
    if (rows.length === 0) {
      toInsert.push({ net_id: netId, ...fields });
      continue;
    }
    toUpdate.push({ id: rows[0].id, ...fields });
    for (const extra of rows.slice(1)) toRemoveIds.push(extra.id);
  }

  for (const [cs, rows] of groups) {
    if (handled.has(cs)) continue;
    for (const row of rows) toRemoveIds.push(row.id);
  }

  return { toInsert, toUpdate, toRemoveIds };
}

/** Case-insensitive match of a callsign to participant rows in one net session. */
export function participantIdsForCallsign(
  existing: { id: string; callsign: string }[],
  callsign: string
): string[] {
  const key = callsign.trim().toUpperCase();
  if (!key) return [];
  return existing
    .filter((p) => p.callsign.trim().toUpperCase() === key)
    .map((p) => p.id);
}

export function shouldSyncNetSignalReport(
  txCallsign: string,
  rxCallsign: string,
  liveCallsigns: Set<string>
): boolean {
  return (
    liveCallsigns.has(txCallsign.toUpperCase()) &&
    liveCallsigns.has(rxCallsign.toUpperCase())
  );
}
