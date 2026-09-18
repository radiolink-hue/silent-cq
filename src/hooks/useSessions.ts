import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CqSession, NewCqSession, CqEventKind, CqSignalReport, NewCqSignalReport } from '@/types';

const SESSION_TTL_MS = 90 * 60 * 1000; // 90 minutes

function isExpired(session: CqSession): boolean {
  return Date.now() - new Date(session.created_at).getTime() > SESSION_TTL_MS;
}

function filterExpired(list: CqSession[]): CqSession[] {
  return list.filter((s) => !isExpired(s));
}

export function useSessions() {
  const [sessions, setSessions] = useState<CqSession[]>([]);
  const [reports, setReports] = useState<CqSignalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('cq_sessions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (err) {
      setError(true);
    } else {
      setError(false);
      setSessions(filterExpired(data ?? []));
    }
    setLoading(false);
  }, []);

  const loadReports = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('cq_signal_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (!err && data) {
      setReports(data as CqSignalReport[]);
    }
  }, []);

  useEffect(() => {
    load();
    loadReports();
    const channel = supabase
      .channel('cq_sessions_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_sessions' },
        (payload) => {
          setSessions((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as CqSession;
              if (!row.active || isExpired(row)) return prev;
              if (prev.some((s) => s.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as CqSession;
              if (!row.active || isExpired(row)) return prev.filter((s) => s.id !== row.id);
              return prev.map((s) => (s.id === row.id ? row : s));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((s) => s.id !== old.id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_signal_reports' },
        () => loadReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, loadReports]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessions((prev) => {
        const expired = prev.filter(isExpired);
        const kept = prev.filter((s) => !isExpired(s));
        if (expired.length > 0) {
          (async () => {
            await supabase
              .from('cq_sessions')
              .update({ active: false })
              .in('id', expired.map((s) => s.id));
          })();
        }
        return kept.length !== prev.length ? kept : prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const createSession = useCallback(async (payload: NewCqSession) => {
    // Remove any older active sessions for this callsign so only one remains
    await supabase
      .from('cq_sessions')
      .update({ active: false })
      .eq('callsign', payload.callsign)
      .eq('active', true);

    const { data, error: err } = await supabase
      .from('cq_sessions')
      .insert(payload)
      .select()
      .maybeSingle();
    if (err || !data) return { error: true as const };

    // Remove older sessions from local state for this callsign
    setSessions((prev) => prev.filter(
      (s) => !(s.callsign.toUpperCase() === payload.callsign.toUpperCase())
    ));

    await supabase.from('cq_events').insert({
      session_id: data.id,
      kind: 'new_cq' satisfies CqEventKind,
      from_callsign: data.callsign,
      target_callsign: '',
      band: data.band,
      mode: data.mode,
      message: `${data.callsign} · ${data.band} ${data.mode} ${data.frequency}`.trim(),
    });
    return { error: false as const, session: data as CqSession };
  }, []);

  const submitReport = useCallback(
    async (sessionId: string, payload: NewCqSignalReport): Promise<{ error: boolean; exists?: boolean }> => {
      const { data, error: err } = await supabase
        .from('cq_signal_reports')
        .insert({ ...payload, session_id: sessionId })
        .select()
        .maybeSingle();
      if (err) {
        if (err.code === '23505') return { error: true, exists: true };
        return { error: true };
      }
      if (data) {
        setReports((prev) => [data as CqSignalReport, ...prev]);
      }

      const next = (reports.filter((r) => r.session_id === sessionId).length + 1);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, heard_count: next } : s))
      );
      await supabase
        .from('cq_sessions')
        .update({ heard_count: next })
        .eq('id', sessionId);

      return { error: false };
    },
    [reports]
  );

  const deleteReport = useCallback(async (reportId: string, sessionId: string): Promise<boolean> => {
    const { error: err } = await supabase.from('cq_signal_reports').delete().eq('id', reportId);
    if (err) return false;
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    const next = Math.max(0, reports.filter((r) => r.session_id === sessionId && r.id !== reportId).length);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, heard_count: next } : s))
    );
    await supabase.from('cq_sessions').update({ heard_count: next }).eq('id', sessionId);
    return true;
  }, [reports]);

  const deleteSession = useCallback(
    async (sessionId: string, callsign: string): Promise<boolean> => {
      const { data, error: err } = await supabase.rpc('delete_own_session', {
        p_session_id: sessionId,
        p_callsign: callsign,
      });
      if (err || !data || data.ok !== true) return false;
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    },
    []
  );

  const hasReported = useCallback(
    (sessionId: string, callsign: string): boolean => {
      return reports.some(
        (r) =>
          r.session_id === sessionId &&
          r.reporter_callsign.toUpperCase() === callsign.toUpperCase()
      );
    },
    [reports]
  );

  const getReportsForSession = useCallback(
    (sessionId: string): CqSignalReport[] => {
      return reports
        .filter((r) => r.session_id === sessionId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    [reports]
  );

  return {
    sessions,
    reports,
    loading,
    error,
    createSession,
    submitReport,
    deleteReport,
    deleteSession,
    hasReported,
    getReportsForSession,
    reload: load,
  };
}
