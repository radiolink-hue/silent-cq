import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Net, NewNet, NetParticipant, NewNetParticipant, SignalReport, NewSignalReport, CqSession, CqSignalReport } from '@/types';
import { NET_SCHEDULES, getActiveNet, getScheduleUtcWindow } from '@/lib/nets';
import { fetchServerUtcNow } from '@/lib/serverClock';
import { DISPLAY_TZ, getZonedCivilTime, jerusalemDateString, jerusalemDateToUtcRange, utcDateString, zonedWallTimeToUtc } from '@/lib/netTime';
import {
  netJerusalemDate,
  netWindowFromClock,
  planRecurringRetimes,
  recurringWindowFromClock,
  recurringWindowFromRow,
  scheduleIdForName,
  windowOnJerusalemDate,
  type NetScheduleTemplateRow,
  type RecurringNetWindow,
} from '@/lib/liveNetSchedule';
import {
  isLiveSilentCqPost,
  liveSilentCqCallsigns,
  planNetParticipantSync,
  participantIdsForCallsign,
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
  const [templates, setTemplates] = useState<RecurringNetWindow[]>([]);
  const [templatesReady, setTemplatesReady] = useState(false);
  const templatesRef = useRef<RecurringNetWindow[]>([]);
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

  const loadTemplates = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('net_schedule_templates')
      .select('schedule_id, start_hour, start_minute, end_hour, end_minute');
    if (err || !data) return;
    const next = (data as NetScheduleTemplateRow[]).flatMap((row) => {
      const window = recurringWindowFromRow(row);
      return window ? [window] : [];
    });
    templatesRef.current = next;
    setTemplates(next);
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
      if (pRes.error) throw pRes.error;
      if (rRes.error) throw rRes.error;
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

    const schedule = getActiveNet(utcNow, templatesRef.current);
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

    for (const row of plan.toInsert) {
      const { net_id, ...fields } = row;
      const { data: latest, error: latestErr } = await supabase
        .from('net_participants')
        .select('id, callsign')
        .eq('net_id', net_id);
      if (latestErr) return;

      const ids = participantIdsForCallsign(latest ?? [], fields.callsign);
      if (ids.length > 0) {
        await supabase.from('net_participants').update(fields).eq('id', ids[0]);
        if (ids.length > 1) {
          await supabase.from('net_participants').delete().in('id', ids.slice(1));
        }
        continue;
      }

      const { error: insertErr } = await supabase.from('net_participants').insert(row);
      if (!insertErr) continue;
      if (insertErr.code !== '23505') return;

      const { data: raced } = await supabase
        .from('net_participants')
        .select('id, callsign')
        .eq('net_id', net_id);
      const racedIds = participantIdsForCallsign(raced ?? [], fields.callsign);
      if (racedIds.length === 0) continue;
      await supabase.from('net_participants').update(fields).eq('id', racedIds[0]);
      if (racedIds.length > 1) {
        await supabase.from('net_participants').delete().in('id', racedIds.slice(1));
      }
    }
  }, []);

  // --- Sync CQ signal reports into net signal reports ---
  const syncSignalReports = useCallback(async (netId: string) => {
    // Get all active session IDs
    const { data: sessions, error: sessionsError } = await supabase
      .from('cq_sessions')
      .select('id, callsign, active, created_at, band, mode, frequency')
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
    if (!templatesReady || syncLockRef.current) return;
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
  }, [ensureScheduledNet, syncParticipants, syncSignalReports, templatesReady]);

  useEffect(() => {
    loadNets();
    void loadTemplates().finally(() => setTemplatesReady(true));
    const netsChannel = supabase
      .channel('nets_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nets' },
        () => loadNets()
      )
      .subscribe();
    const templateChannel = supabase
      .channel('net_schedule_templates_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'net_schedule_templates' },
        () => loadTemplates()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(netsChannel);
      supabase.removeChannel(templateChannel);
    };
  }, [loadNets, loadTemplates]);

  // Auto-sync: check every 60 seconds for active net, after templates have loaded.
  useEffect(() => {
    if (!templatesReady) return;
    autoSync();
    const interval = setInterval(autoSync, 60_000);
    return () => clearInterval(interval);
  }, [autoSync, templatesReady]);

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

  const updateNetSchedule = useCallback(async (net: Net, startHHMM: string, endHHMM: string): Promise<boolean> => {
    const scheduleId = scheduleIdForName(net.name);
    if (!scheduleId) {
      const window = netWindowFromClock(net, startHHMM, endHHMM);
      if (!window) return false;
      const { data, error: err } = await supabase
        .from('nets')
        .update({ starts_at: window.startsAt, ends_at: window.endsAt })
        .eq('id', net.id)
        .select()
        .maybeSingle();
      if (err || !data) return false;
      const saved = data as Net;
      setNets((prev) => prev.map((row) => (row.id === net.id ? saved : row)));
      return true;
    }

    const clock = recurringWindowFromClock(scheduleId, startHHMM, endHHMM);
    if (!clock) return false;

    const utcNow = (await fetchServerUtcNow()) ?? new Date();
    const today = jerusalemDateString(utcNow);
    const { error: templateError } = await supabase.from('net_schedule_templates').upsert(
      {
        schedule_id: scheduleId,
        start_hour: clock.startHour,
        start_minute: clock.startMinute,
        end_hour: clock.endHour,
        end_minute: clock.endMinute,
        updated_at: utcNow.toISOString(),
      },
      { onConflict: 'schedule_id' }
    );
    if (templateError) return false;

    const { start } = jerusalemDateToUtcRange(today);
    const { data: fetched, error: fetchError } = await supabase
      .from('nets')
      .select('*')
      .or(`net_date.gte.${today},starts_at.gte.${start.toISOString()}`);
    if (fetchError) return false;

    const candidates = (fetched ?? []) as Net[];
    const planned = planRecurringRetimes(candidates, scheduleId, clock, today);
    for (const change of planned) {
      const { error: rowError } = await supabase
        .from('nets')
        .update({ starts_at: change.startsAt, ends_at: change.endsAt })
        .eq('id', change.id);
      if (rowError) return false;
    }

    const base = NET_SCHEDULES.find((item) => item.id === scheduleId);
    const civil = getZonedCivilTime(utcNow);
    const runsToday = !!base && (base.dayOfWeek === -1 || base.dayOfWeek === civil.dayOfWeek);
    const todayCovered = candidates.some(
      (row) => scheduleIdForName(row.name) === scheduleId && netJerusalemDate(row) === today
    );
    let inserted: Net | null = null;
    if (runsToday && base && !todayCovered) {
      const window = windowOnJerusalemDate(civil.year, civil.month, civil.day, clock);
      if (!window) return false;
      const payload: NewNet = {
        name: base.name,
        net_date: utcDateString(new Date(window.startsAt)),
        frequency: base.frequency,
        mode: base.mode,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
      };
      const { data, error: insertError } = await supabase.from('nets').insert(payload).select().maybeSingle();
      if (insertError) {
        if (insertError.code !== '23505') return false;
        const raced = await fetchExistingNet(base.name, payload.net_date);
        if (!raced) return false;
        const { error: racedError } = await supabase
          .from('nets')
          .update({ starts_at: window.startsAt, ends_at: window.endsAt })
          .eq('id', raced.id);
        if (racedError) return false;
        inserted = { ...raced, starts_at: window.startsAt, ends_at: window.endsAt };
      } else if (data) {
        inserted = data as Net;
      } else {
        return false;
      }
    }

    const nextTemplates = [
      ...templatesRef.current.filter((item) => item.scheduleId !== clock.scheduleId),
      clock,
    ];
    templatesRef.current = nextTemplates;
    setTemplates(nextTemplates);
    const changes = new Map(planned.map((change) => [change.id, change]));
    setNets((prev) => {
      const seen = new Set<string>();
      const next = prev.map((row) => {
        seen.add(row.id);
        const change = changes.get(row.id);
        return change ? { ...row, starts_at: change.startsAt, ends_at: change.endsAt } : row;
      });
      for (const row of candidates) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const change = changes.get(row.id);
        next.push(change ? { ...row, starts_at: change.startsAt, ends_at: change.endsAt } : row);
      }
      if (inserted && !seen.has(inserted.id)) next.unshift(inserted);
      return next;
    });
    return true;
  }, []);

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
    templates,
    participants,
    reports,
    loading,
    error,
    selectedNetId,
    setSelectedNetId,
    createNet,
    addParticipant,
    addReport,
    updateNetSchedule,
    deleteNet,
    deleteParticipant,
    deleteReport,
    fetchNetsByDate,
    fetchNetsInDateRange,
    fetchNetExportData,
    reload: loadNets,
  };
}
