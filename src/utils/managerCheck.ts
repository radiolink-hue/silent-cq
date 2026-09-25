import { supabase } from '@/lib/supabase';
import { ADMIN_CALLSIGN } from '@/lib/adminProxy';

/** Admin Posted / privilege flags only — never gate Call Silent CQ. */
export async function isManagerOrAdmin(callsign: string): Promise<boolean> {
  const cs = callsign.trim().toUpperCase();
  if (cs === ADMIN_CALLSIGN) return true;

  try {
    const { data, error } = await supabase
      .from('managers')
      .select('callsign')
      .eq('callsign', cs)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}
