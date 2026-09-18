import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Net, NewNet, NetParticipant, NewNetParticipant, SignalReport, NewSignalReport, CqSession, CqSignalReport } from '@/types';
import { getActiveNet, formatArchiveName, NET_SCHEDULES, NetSchedule } from '@/lib/nets';

export function useNets() {
  const [nets, setNets] = useState<Net[]>([]);
  const [participants, setParticipants] = useState<NetParticipant[]>([]);
  const [reports, setReports] = useState<SignalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);
  const syncLockRef = useRef(false);

  const loadNets = useCallback(async () => {
    const minDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error: err } = await supabase
      .from('nets')
      .select('*')
      .gte('net_date', minDate)
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
    const { data, error: err } = await supabase
      .from('nets')
      .select('*')
      .eq('net_date', date)
      .order('created_at', { ascending: false });
    if (err) return [];
    return data as Net[];
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
    const schedule = getActiveNet();
    if (!schedule) return null;

    const today = new Date().toISOString().slice(0, 10);

    // Check if a net for this schedule already exists today
    const { data: existing } = await supabase
      .from('nets')
      .select('id')
      .eq('net_date', today)
      .ilike('name', `${schedule.name}%`)
      .maybeSingle();

    if (existing) return existing.id;

    // Create the net
    const payload: NewNet = {
      name: schedule.name,
      net_date: today,
      frequency: schedule.frequency,
      mode: schedule.mode,
    };

    const { data, error: err } = await supabase
      .from('nets')
      .insert(payload)
      .select()
      .maybeSingle();

    if (err || !data) return null;

    const net = data as Net;
    setNets((prev) => [net, ...prev]);
    return net.id;
  }, []);

  // --- Sync active CQ sessions into net participants ---
  const syncParticipants = useCallback(async (netId: string) => {
    const { data: sessions } = await supabase
      .from('cq_sessions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!sessions || sessions.length === 0) return;

    const { data: existingParticipants } = await supabase
      .from('net_participants')
      .select('callsign')
      .eq('net_id', netId);

    const existingCallsigns = new Set(
      (existingParticipants ?? []).map((p: { callsign: string }) => p.callsign.toUpperCase())
    );

    const toInsert: { net_id: string; callsign: string; grid: string; city: string; antenna: string; power: string }[] = [];

    for (const session of sessions as CqSession[]) {
      const cs = session.callsign.toUpperCase();
      if (existingCallsigns.has(cs)) continue;

      toInsert.push({
        net_id: netId,
        callsign: cs,
        grid: session.gridsquare || '',
        city: session.city || '',
        antenna: session.antenna || '',
        power: session.power || '',
      });
    }

    if (toInsert.length > 0) {
      await supabase.from('net_participants').insert(toInsert);
    }
  }, []);

  // --- Sync CQ signal reports into net signal reports ---
  const syncSignalReports = useCallback(async (netId: string) => {
    // Get all active session IDs
    const { data: sessions } = await supabase
      .from('cq_sessions')
      .select('id, callsign')
      .eq('active', true);

    if (!sessions || sessions.length === 0) return;

    const sessionIds = (sessions as { id: string; callsign: string }[]).map((s) => s.id);
    const sessionCallsignMap = new Map<string, string>();
    for (const s of sessions as { id: string; callsign: string }[]) {
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
    const { data, error: err } = await supabase
      .from('nets')
      .insert(payload)
      .select()
      .maybeSingle();
    if (err || !data) return { error: true };
    const net = data as Net;
    setNets((prev) => [net, ...prev]);
    setSelectedNetId(net.id);
    return { error: false, net };
  }, []);

  const addParticipant = useCallback(
    async (netId: string, payload: NewNetParticipant): Promise<{ error: boolean; exists?: boolean }> => {
      const { data, error: err } = await supabase
        .from('net_participants')
        .insert({ ...payload, net_id: netId })
        .select()
        .maybeSingle();
      if (err) {
        if (err.code === '23505') return { error: true, exists: true };
        return { error: true };
      }
      if (data) {
        setParticipants((prev) =>
          prev.some((p) => p.callsign.toUpperCase() === payload.callsign.toUpperCase())
            ? prev
            : [...prev, data as NetParticipant].sort((a, b) =>
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
    fetchNetExportData,
    reload: loadNets,
  };
}
