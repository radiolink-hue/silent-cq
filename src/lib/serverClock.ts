import { supabase } from '@/lib/supabase';

/** UTC instant from the database clock. Returns null if the server cannot be reached. */
export async function fetchServerUtcNow(): Promise<Date | null> {
  const { data, error } = await supabase.rpc('server_utc_now');
  if (error || data == null) return null;
  const date = new Date(typeof data === 'string' ? data : String(data));
  return Number.isNaN(date.getTime()) ? null : date;
}
