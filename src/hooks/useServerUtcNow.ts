import { useCallback, useEffect, useState } from 'react';
import { fetchServerUtcNow } from '@/lib/serverClock';

const POLL_MS = 60_000;

/** Server UTC clock for net scheduling. Never falls back to the browser timezone. */
export function useServerUtcNow(): Date | null {
  const [utcNow, setUtcNow] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchServerUtcNow();
    if (next) setUtcNow(next);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return utcNow;
}
