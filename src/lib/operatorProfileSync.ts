import { supabase } from '@/lib/supabase';
import { normalizeOperatorAntenna, parseOperatorPower } from './operatorProfile';

export interface OperatorProfileRecord {
  power: number | null;
  antenna: string | null;
}

export async function fetchOperatorProfileRecord(callsign: string): Promise<OperatorProfileRecord | null> {
  const key = callsign.trim().toUpperCase();
  if (!key) return null;
  const { data, error } = await supabase
    .from('operator_profiles')
    .select('power, antenna')
    .eq('callsign', key)
    .maybeSingle();
  if (error) return null;
  return {
    power: data ? parseOperatorPower(data.power) : null,
    antenna: data ? normalizeOperatorAntenna(data.antenna) : null,
  };
}

export async function fetchOperatorPower(callsign: string): Promise<number | null> {
  const record = await fetchOperatorProfileRecord(callsign);
  return record?.power ?? null;
}

export async function persistOperatorProfileRecord(
  callsign: string,
  fields: { power?: number | null; antenna?: string | null }
): Promise<void> {
  const key = callsign.trim().toUpperCase();
  if (!key) return;
  const payload: { callsign: string; updated_at: string; power?: number; antenna?: string } = {
    callsign: key,
    updated_at: new Date().toISOString(),
  };
  const power = fields.power == null ? null : parseOperatorPower(fields.power);
  const antenna = normalizeOperatorAntenna(fields.antenna);
  if (power != null) payload.power = power;
  if (antenna != null) payload.antenna = antenna;
  if (payload.power == null && payload.antenna == null) return;
  await supabase.from('operator_profiles').upsert(payload, { onConflict: 'callsign' });
}

export async function persistOperatorPower(callsign: string, power: number): Promise<void> {
  await persistOperatorProfileRecord(callsign, { power });
}
