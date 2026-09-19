import { useCallback, useEffect, useRef, useState } from 'react';

export type AllmonStatus = 'idle' | 'live' | 'fallback' | 'error';

interface AllmonResponse {
  status: 'live' | 'fallback' | 'error' | 'idle';
  node: string;
  nodes: { node: string; callsign: string; transmitting: boolean }[];
  transmittingNode: string | null;
  error?: string | null;
  upserted?: number;
  message?: string;
}

const POLL_INTERVAL_MS = 30_000;

export function useAllstarMonitor() {
  const [status, setStatus] = useState<AllmonStatus>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/allmon2`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      };
      const resp = await fetch(apiUrl, { headers });
      if (!resp.ok) {
        if (mounted.current) setStatus('fallback');
        return;
      }
      const data: AllmonResponse = await resp.json();
      if (!mounted.current) return;

      if (data.status === 'live') {
        setStatus('live');
        setLastSync(new Date());
      } else if (data.status === 'fallback') {
        setStatus('fallback');
        setLastSync(new Date());
      } else if (data.status === 'idle') {
        setStatus('idle');
      } else {
        setStatus('fallback');
      }
    } catch {
      // Graceful timeout — don't show error, fall back to standby
      if (mounted.current) setStatus('fallback');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [poll]);

  return { status, lastSync, refresh: poll };
}
