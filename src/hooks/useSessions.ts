import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CqSession, NewCqSession, CqEventKind, CqSignalReport, NewCqSignalReport } from '@/types';
import { isExpiredCqSession } from '@/lib/cqPresence';
import { ADMIN_CALLSIGN, ACTIVE_CQ_SESSION_SELECT, canReplaceWithProxy, hydrateProxySession, withProxyRfFallback } from '@/lib/adminProxy';

function filterExpired(list: CqSession[]): CqSession[] {
  return list.filter((s) => !isExpiredCqSession(s));
}

function sameSessionList(a: CqSession[], b: CqSession[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.callsign !== y.callsign ||
      x.band !== y.band ||
      x.mode !== y.mode ||
      x.frequency !== y.frequency ||
      x.power !== y.power ||
      x.antenna !== y.antenna ||
      x.city !== y.city ||
      x.gridsquare !== y.gridsquare ||
      x.heard_count !== y.heard_count ||
      x.active !== y.active ||
      x.created_at !== y.created_at ||
      x.comments !== y.comments ||
      x.is_proxy !== y.is_proxy ||
      x.proxy_added_by !== y.proxy_added_by
    ) {
      return false;
    }
  }
  return true;
}

export function useSessions(pollWhenVisible = false) {
  const [sessions, setSessions] = useState<CqSession[]>([]);
  const [reports, setReports] = useState<CqSignalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const { data, error: err } = await supabase
      .from('cq_sessions')
      .select(ACTIVE_CQ_SESSION_SELECT)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (err) {
      if (!opts?.silent) setError(true);
    } else {
      setError(false);
      const next = filterExpired((data ?? []).map((row) => hydrateProxySession(row as CqSession)));
      setSessions((prev) => (sameSessionList(prev, next) ? prev : next));
    }
    if (!opts?.silent) setLoading(false);
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
              const row = hydrateProxySession(payload.new as CqSession);
              if (!row.active || isExpiredCqSession(row)) return prev;
              if (prev.some((s) => s.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const incoming = hydrateProxySession(payload.new as CqSession);
              if (!incoming.active || isExpiredCqSession(incoming)) return prev.filter((s) => s.id !== incoming.id);
              return prev.map((s) => {
                if (s.id !== incoming.id) return s;
                return hydrateProxySession({
                  ...s,
                  ...incoming,
                  is_proxy: incoming.is_proxy || s.is_proxy,
                  proxy_added_by: incoming.proxy_added_by ?? s.proxy_added_by,
                });
              });
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
        const expired = prev.filter((s) => isExpiredCqSession(s));
        const kept = prev.filter((s) => !isExpiredCqSession(s));
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

  useEffect(() => {
    if (!pollWhenVisible) return;
    void load({ silent: true });
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 30_000);
    return () => clearInterval(interval);
  }, [pollWhenVisible, load]);

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

    const session = data as CqSession;
    setSessions((prev) => [
      session,
      ...prev.filter((s) => s.callsign.toUpperCase() !== payload.callsign.toUpperCase()),
    ]);

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

  const createProxySession = useCallback(async (payload: NewCqSession) => {
    const callsign = payload.callsign.trim().toUpperCase();
    const row = withProxyRfFallback({ ...payload, callsign });

    const listed = await supabase
      .from('cq_sessions')
      .select(ACTIVE_CQ_SESSION_SELECT)
      .eq('active', true);

    const matches = ((listed.data ?? []) as CqSession[])
      .map((s) => hydrateProxySession(s))
      .filter(
        (s) =>
          s.callsign.trim().toUpperCase() === callsign &&
          !isExpiredCqSession(s)
      );

    if (!canReplaceWithProxy(matches)) {
      return { error: true as const, selfReported: true as const };
    }

    if (matches.length > 0) {
      await supabase
        .from('cq_sessions')
        .update({ active: false })
        .in('id', matches.map((s) => s.id));
    }

    const proxyRow = {
      ...row,
      is_proxy: true,
      proxy_added_by: ADMIN_CALLSIGN,
    };

    let { data, error: err } = await supabase
      .from('cq_sessions')
      .insert(proxyRow)
      .select('*')
      .maybeSingle();

    // Still publish to Active Users if proxy columns are unavailable.
    if (err || !data) {
      const fallback = await supabase.from('cq_sessions').insert(row).select().maybeSingle();
      data = fallback.data;
      err = fallback.error;
    }

    if (err || !data) return { error: true as const };

    const session = hydrateProxySession({
      ...(data as CqSession),
      is_proxy: true,
      proxy_added_by: ADMIN_CALLSIGN,
    });
    setSessions((prev) => [
      session,
      ...prev.filter((s) => s.callsign.toUpperCase() !== callsign),
    ]);

    await supabase.from('cq_events').insert({
      session_id: data.id,
      kind: 'new_cq' satisfies CqEventKind,
      from_callsign: ADMIN_CALLSIGN,
      target_callsign: callsign,
      band: data.band,
      mode: data.mode,
      message: `${callsign} · ${data.band} ${data.mode} ${data.frequency}`.trim(),
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
    createProxySession,
    submitReport,
    deleteReport,
    deleteSession,
    hasReported,
    getReportsForSession,
    reload: load,
  };
}
