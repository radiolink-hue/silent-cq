import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Net, NewNet, NetParticipant, NewNetParticipant, SignalReport, NewSignalReport, CqSession, CqSignalReport } from '@/types';
import { getActiveNet, getScheduleUtcWindow } from '@/lib/nets';
import { fetchServerUtcNow } from '@/lib/serverClock';
import { DISPLAY_TZ, jerusalemDateToUtcRange, utcDateString, zonedWallTimeToUtc } from '@/lib/netTime';
import {
  isLiveSilentCqPost,
  liveSilentCqCallsigns,
  planNetParticipantSync,
  shouldSyncNetSignalReport,
} from '@/lib/cqPresence';
import { pickExistingNetSession } from '@/lib/netSession';

async function fetchExistingNet(name: string, netDate: string): Promise<Net | null> {
  const { data, error } = await supabase
    .from('nets')
    .select('*')
    .eq('net_date', netDate);
  if (error || !data) return null;
  return pickExistingNetSession(data as Net[], name) ?? null;
}

export function useNets() {
  const [nets, setNets] = useState<Net[]>([]);
  const [participants, setParticipants] = useState<NetParticipant[]>([]);
  const [reports, setReports] = useState<SignalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);
  const syncLockRef = useRef(false);

  const loadNets = useCallback(async () => {
    const utcNow = (await fetchServerUtcNow()) ?? new Date();
    const cutoff = new Date(utcNow.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data, error: err } = await supabase
      .from('nets')
      .select('*')
      .or(`starts_at.gte.${cutoff.toISOString()},and(starts_at.is.null,net_date.gte.${utcDateString(cutoff)})`)
      .order('net_date', { ascending: false });
    if (err) {
      setError(true);
    } else {
      setError(false);
      setNets(data ?? []);
    }
    setLoading(false);
  }, []);

  const fetchNetsByDate = useCallback(async (date: string): Promise<Net[]> => {
    const { start, end } = jerusalemDateToUtcRange(date);
    const [byStart, byDate] = await Promise.all([
      supabase
        .from('nets')
        .select('*')
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('nets')
        .select('*')
        .eq('net_date', date)
        .is('starts_at', null)
        .order('created_at', { ascending: false }),
    ]);
    const rows = [...(byStart.data ?? []), ...(byDate.data ?? [])] as Net[];
    const seen = new Set<string>();
    return rows.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, []);

  const fetchNetsInDateRange = useCallback(async (from: string, to: string): Promise<Net[]> => {
    const { start } = jerusalemDateToUtcRange(from);
    const { end } = jerusalemDateToUtcRange(to);
    const [byDate, byStart] = await Promise.all([
      supabase
        .from('nets')
        .select('*')
        .gte('net_date', from)
        .lte('net_date', to)
        .order('net_date', { ascending: true }),
      supabase
        .from('nets')
        .select('*')
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
        .order('net_date', { ascending: true }),
    ]);
    const rows = [...(byDate.data ?? []), ...(byStart.data ?? [])] as Net[];
    const seen = new Set<string>();
    return rows
      .filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      })
      .sort((a, b) => a.net_date.localeCompare(b.net_date) || a.name.localeCompare(b.name));
  }, []);

  const fetchNetExportData = useCallback(
    async (netId: string): Promise<{ participants: NetParticipant[]; reports: SignalReport[] }> => {
      const [pRes, rRes] = await Promise.all([
        supabase.from('net_participants').select('*').eq('net_id', netId).order('callsign'),
        supabase.from('signal_reports').select('*').eq('net_id', netId).order('created_at'),
      ]);
      return {
        participants: (pRes.data ?? []) as NetParticipant[],
        reports: (rRes.data ?? []) as SignalReport[],
      };
    },
    []
  );

  const loadNetDetails = useCallback(async (netId: string) => {
    const [pRes, rRes] = await Promise.all([
      supabase.from('net_participants').select('*').eq('net_id', netId).order('callsign'),
      supabase.from('signal_reports').select('*').eq('net_id', netId).order('created_at'),
    ]);
    if (pRes.error || rRes.error) {
      setError(true);
    } else {
      setError(false);
      setParticipants(pRes.data ?? []);
      setReports(rRes.data ?? []);
    }
  }, []);

  // --- Auto-create scheduled net if one is active and doesn't exist yet ---
  const ensureScheduledNet = useCallback(async (): Promise<string | null> => {
    const utcNow = await fetchServerUtcNow();
    if (!utcNow) return null;

    const schedule = getActiveNet(utcNow);
    if (!schedule) return null;

    const { startsAt, endsAt } = getScheduleUtcWindow(schedule, utcNow);
    const netDate = utcDateString(startsAt);

    const existing = await fetchExistingNet(schedule.name, netDate);
    if (existing) return existing.id;

    const payload: NewNet = {
      name: schedule.name,
      net_date: netDate,
      frequency: schedule.frequency,
      mode: schedule.mode,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };

    const { data, error: err } = await supabase
      .from('nets')
      .insert(payload)
      .select()
      .maybeSingle();

    if (err) {
      if (err.code === '23505') {
        const raced = await fetchExistingNet(schedule.name, netDate);
        return raced?.id ?? null;
      }
      return null;
    }
    if (!data) return null;

    const net = data as Net;
    setNets((prev) => [net, ...prev]);
    return net.id;
  }, []);

  // --- Sync live Silent CQ posts into net participants (login-only users stay out) ---
  const syncParticipants = useCallback(async (netId: string) => {
    const { data: sessions, error: sessionsError } = await supabase
      .from('cq_sessions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (sessionsError) return;

    const { data: existingParticipants, error: existingError } = await supabase
      .from('net_participants')
      .select('id, callsign')
      .eq('net_id', netId);
    if (existingError) return;

    const plan = planNetParticipantSync(
      netId,
      (sessions ?? []) as CqSession[],
      (existingParticipants ?? []) as { id: string; callsign: string }[]
    );

    if (plan.toRemoveIds.length > 0) {
      await supabase.from('net_participants').delete().in('id', plan.toRemoveIds);
    }

    for (const row of plan.toUpdate) {
      const { id, ...fields } = row;
      await supabase.from('net_participants').update(fields).eq('id', id);
    }

    if (plan.toInsert.length > 0) {
      await supabase.from('net_participants').insert(plan.toInsert);
    }
  }, []);

  // --- Sync CQ signal reports into net signal reports ---
  const syncSignalReports = useCallback(async (netId: string) => {
    // Get all active session IDs
    const { data: sessions, error: sessionsError } = await supabase
      .from('cq_sessions')
      .select('id, callsign, active, created_at, band, mode, frequency, allstar_source')
      .eq('active', true);
    if (sessionsError) return;

    const liveSessions = ((sessions ?? []) as CqSession[]).filter((s) => isLiveSilentCqPost(s));
    if (liveSessions.length === 0) return;

    const liveCallsigns = liveSilentCqCallsigns(liveSessions);
    const sessionIds = liveSessions.map((s) => s.id);
    const sessionCallsignMap = new Map<string, string>();
    for (const s of liveSessions) {
      sessionCallsignMap.set(s.id, s.callsign.toUpperCase());
    }

    // Get CQ signal reports for those sessions
    const { data: cqReports } = await supabase
      .from('cq_signal_reports')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (!cqReports || cqReports.length === 0) return;

    // Get existing net signal reports to avoid duplicates
    const { data: existingReports } = await supabase
      .from('signal_reports')
      .select('tx_callsign, rx_callsign')
      .eq('net_id', netId);

    const existingKeys = new Set(
      (existingReports ?? []).map((r: { tx_callsign: string; rx_callsign: string }) =>
        `${r.tx_callsign.toUpperCase()}:${r.rx_callsign.toUpperCase()}`
      )
    );

    const toInsert: { net_id: string; tx_callsign: string; rx_callsign: string; rst_report: string }[] = [];

    for (const r of cqReports as CqSignalReport[]) {
      const txCallsign = sessionCallsignMap.get(r.session_id);
      if (!txCallsign) continue;

      const rxCallsign = r.reporter_callsign.toUpperCase();
      if (!shouldSyncNetSignalReport(txCallsign, rxCallsign, liveCallsigns)) continue;
      const key = `${txCallsign}:${rxCallsign}`;
      if (existingKeys.has(key)) continue;

      toInsert.push({
        net_id: netId,
        tx_callsign: txCallsign,
        rx_callsign: rxCallsign,
        rst_report: r.signal_report || '',
      });
    }

    if (toInsert.length > 0) {
      await supabase.from('signal_reports').insert(toInsert);
    }
  }, []);

  // --- Main auto-sync routine ---
  const autoSync = useCallback(async () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;

    try {
      const netId = await ensureScheduledNet();
      if (!netId) {
        syncLockRef.current = false;
        return;
      }

      // Auto-select the active scheduled net if nothing is selected
      setSelectedNetId((prev) => prev ?? netId);

      await Promise.all([syncParticipants(netId), syncSignalReports(netId)]);
    } finally {
      syncLockRef.current = false;
    }
  }, [ensureScheduledNet, syncParticipants, syncSignalReports]);

  useEffect(() => {
    loadNets();
    const channel = supabase
      .channel('nets_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nets' },
        () => loadNets()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNets]);

  // Auto-sync: check every 60 seconds for active net
  useEffect(() => {
    autoSync();
    const interval = setInterval(autoSync, 60_000);
    return () => clearInterval(interval);
  }, [autoSync]);

  // Also trigger sync when CQ sessions change (realtime)
  useEffect(() => {
    const channel = supabase
      .channel('cq_sessions_for_net_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_sessions' },
        () => autoSync()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_signal_reports' },
        () => autoSync()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoSync]);

  useEffect(() => {
    if (!selectedNetId) {
      setParticipants([]);
      setReports([]);
      return;
    }
    loadNetDetails(selectedNetId);
    const channel = supabase
      .channel(`net_${selectedNetId}_stream`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'net_participants', filter: `net_id=eq.${selectedNetId}` },
        () => loadNetDetails(selectedNetId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signal_reports', filter: `net_id=eq.${selectedNetId}` },
        () => loadNetDetails(selectedNetId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedNetId, loadNetDetails]);

  const createNet = useCallback(async (payload: NewNet): Promise<{ error: boolean; net?: Net }> => {
    let insertPayload = payload;
    if (!payload.starts_at || !payload.ends_at) {
      const [y, m, d] = payload.net_date.split('-').map((n) => parseInt(n, 10));
      const startsAt = zonedWallTimeToUtc(DISPLAY_TZ, y, m, d, 0, 0);
      const endsAt = zonedWallTimeToUtc(DISPLAY_TZ, y, m, d, 23, 59);
      insertPayload = {
        ...payload,
        net_date: utcDateString(startsAt),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      };
    }

    const adopt = (net: Net) => {
      setNets((prev) => (prev.some((n) => n.id === net.id) ? prev : [net, ...prev]));
      setSelectedNetId(net.id);
      return { error: false, net };
    };

    const existing = await fetchExistingNet(insertPayload.name, insertPayload.net_date);
    if (existing) return adopt(existing);

    const { data, error: err } = await supabase
      .from('nets')
      .insert(insertPayload)
      .select()
      .maybeSingle();
    if (err) {
      if (err.code === '23505') {
        const raced = await fetchExistingNet(insertPayload.name, insertPayload.net_date);
        if (!raced) return { error: true };
        return adopt(raced);
      }
      return { error: true };
    }
    if (!data) return { error: true };
    const net = data as Net;
    setNets((prev) => [net, ...prev]);
    setSelectedNetId(net.id);
    return { error: false, net };
  }, []);

  const addParticipant = useCallback(
    async (netId: string, payload: NewNetParticipant): Promise<{ error: boolean; exists?: boolean }> => {
      const callsign = payload.callsign.trim().toUpperCase();
      const fields = {
        callsign,
        grid: payload.grid ?? '',
        city: payload.city ?? '',
        antenna: payload.antenna ?? '',
        power: payload.power ?? '',
      };

      const { data: existing, error: existingErr } = await supabase
        .from('net_participants')
        .select('id, callsign')
        .eq('net_id', netId);
      if (existingErr) return { error: true };

      const matches = (existing ?? []).filter(
        (p) => p.callsign.trim().toUpperCase() === callsign
      );

      if (matches.length > 0) {
        const keepId = matches[0].id;
        const extraIds = matches.slice(1).map((p) => p.id);
        const { data, error: err } = await supabase
          .from('net_participants')
          .update(fields)
          .eq('id', keepId)
          .select()
          .maybeSingle();
        if (err || !data) return { error: true };
        if (extraIds.length > 0) {
          await supabase.from('net_participants').delete().in('id', extraIds);
        }
        setParticipants((prev) =>
          prev
            .filter((p) => p.id === keepId || !extraIds.includes(p.id))
            .map((p) => (p.id === keepId ? (data as NetParticipant) : p))
            .sort((a, b) => a.callsign.localeCompare(b.callsign))
        );
        return { error: false };
      }

      const { data, error: err } = await supabase
        .from('net_participants')
        .insert({ ...fields, net_id: netId })
        .select()
        .maybeSingle();
      if (err) {
        if (err.code === '23505') return { error: true, exists: true };
        return { error: true };
      }
      if (data) {
        setParticipants((prev) =>
          [...prev, data as NetParticipant].sort((a, b) =>
            a.callsign.localeCompare(b.callsign)
          )
        );
      }
      return { error: false };
    },
    []
  );

  const addReport = useCallback(
    async (netId: string, payload: NewSignalReport): Promise<{ error: boolean; exists?: boolean }> => {
      const { data, error: err } = await supabase
        .from('signal_reports')
        .insert({ ...payload, net_id: netId })
        .select()
        .maybeSingle();
      if (err) {
        if (err.code === '23505') return { error: true, exists: true };
        return { error: true };
      }
      if (data) {
        setReports((prev) =>
          prev.some(
            (r) =>
              r.tx_callsign.toUpperCase() === payload.tx_callsign.toUpperCase() &&
              r.rx_callsign.toUpperCase() === payload.rx_callsign.toUpperCase()
          )
            ? prev
            : [...prev, data as SignalReport]
        );
      }
      return { error: false };
    },
    []
  );

  const deleteNet = useCallback(async (netId: string): Promise<boolean> => {
    const { error: err } = await supabase.from('nets').delete().eq('id', netId);
    if (err) return false;
    setNets((prev) => prev.filter((n) => n.id !== netId));
    if (selectedNetId === netId) setSelectedNetId(null);
    return true;
  }, [selectedNetId]);

  const deleteParticipant = useCallback(async (participantId: string): Promise<boolean> => {
    const { error: err } = await supabase.from('net_participants').delete().eq('id', participantId);
    if (err) return false;
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    return true;
  }, []);

  const deleteReport = useCallback(async (reportId: string): Promise<boolean> => {
    const { error: err } = await supabase.from('signal_reports').delete().eq('id', reportId);
    if (err) return false;
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    return true;
  }, []);

  return {
    nets,
    participants,
    reports,
    loading,
    error,
    selectedNetId,
    setSelectedNetId,
    createNet,
    addParticipant,
    addReport,
    deleteNet,
    deleteParticipant,
    deleteReport,
    fetchNetsByDate,
    fetchNetsInDateRange,
    fetchNetExportData,
    reload: loadNets,
  };
}
