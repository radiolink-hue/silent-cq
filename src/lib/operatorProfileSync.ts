import { supabase } from '@/lib/supabase';
import { parseOperatorPower } from './operatorProfile';

export async function fetchOperatorPower(callsign: string): Promise<number | null> {
  const key = callsign.trim().toUpperCase();
  if (!key) return null;
  const { data, error } = await supabase
    .from('operator_profiles')
    .select('power')
    .eq('callsign', key)
    .maybeSingle();
  if (error || data?.power == null) return null;
  return parseOperatorPower(data.power);
}

export async function persistOperatorPower(callsign: string, power: number): Promise<void> {
  const key = callsign.trim().toUpperCase();
  const parsed = parseOperatorPower(power);
  if (!key || parsed == null) return;
  await supabase.from('operator_profiles').upsert(
    {
      callsign: key,
      power: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'callsign' }
  );
}
