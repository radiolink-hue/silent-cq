import { CqSession, NetParticipant } from '../types';

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

export interface NetParticipantSyncPlan {
  toInsert: {
    net_id: string;
    callsign: string;
    grid: string;
    city: string;
    antenna: string;
    power: string;
  }[];
  toRemoveIds: string[];
}

export function planNetParticipantSync(
  netId: string,
  sessions: CqSession[],
  existing: { id: string; callsign: string }[],
  now: number = Date.now()
): NetParticipantSyncPlan {
  const liveSessions = sessions.filter((s) => isLiveSilentCqPost(s, now));
  const liveCallsigns = liveSilentCqCallsigns(liveSessions, now);

  const toRemoveIds = existing
    .filter((p) => !liveCallsigns.has(p.callsign.toUpperCase()))
    .map((p) => p.id);

  const existingLive = new Set(
    existing
      .filter((p) => liveCallsigns.has(p.callsign.toUpperCase()))
      .map((p) => p.callsign.toUpperCase())
  );

  const seen = new Set(existingLive);
  const toInsert: NetParticipantSyncPlan['toInsert'] = [];

  for (const session of liveSessions) {
    const cs = session.callsign.trim().toUpperCase();
    if (seen.has(cs)) continue;
    seen.add(cs);
    toInsert.push({
      net_id: netId,
      callsign: cs,
      grid: session.gridsquare || '',
      city: session.city || '',
      antenna: session.antenna || '',
      power: session.power || '',
    });
  }

  return { toInsert, toRemoveIds };
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
