import { supabase } from '@/lib/supabase';
import { ADMIN_CALLSIGN } from '@/lib/adminProxy';

export async function isManagerOrAdmin(callsign: string): Promise<boolean> {
  if (callsign.trim().toUpperCase() === ADMIN_CALLSIGN) return true;

  const { data, error } = await supabase
    .from('managers')
    .select('callsign')
    .eq('callsign', callsign.trim().toUpperCase())
    .maybeSingle();

  return !error && !!data;
}
