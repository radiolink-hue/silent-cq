export interface CqSession {
  id: string;
  callsign: string;
  gridsquare: string;
  band: string;
  mode: string;
  frequency: string;
  power: string;
  antenna: string;
  city: string;
  country: string;
  comments: string;
  lat: number | null;
  lng: number | null;
  heard_count: number;
  active: boolean;
  created_at: string;
  allstar_source?: string;
  is_proxy?: boolean;
  proxy_added_by?: string | null;
}

export type CqEventKind = 'new_cq' | 'received_ok' | 'calling_you';

export interface CqEvent {
  id: string;
  session_id: string | null;
  kind: CqEventKind;
  from_callsign: string;
  target_callsign: string;
  band: string;
  mode: string;
  message: string;
  created_at: string;
}

export type NewCqSession = Omit<
  CqSession,
  'id' | 'heard_count' | 'active' | 'created_at' | 'is_proxy' | 'proxy_added_by'
>;

export const BANDS = [
  '160m', '80m', '60m', '40m', '30m', '20m', '17m',
  '15m', '12m', '10m', '6m', '2m', '70cm', '23cm',
] as const;

export const MODES = [
  'LSB', 'USB', 'CW', 'AM', 'FM', 'FT8', 'FT4', 'JS8', 'RTTY', 'PSK31', 'SSTV',
  'VARAC', 'SATELLITE', 'DIGITAL VOICE',
] as const;

/** Conventional voice mode for a band; the operator can still override the dropdown. */
export function defaultModeForBand(band: string): string {
  if (band === '40m' || band === '60m' || band === '80m' || band === '160m') return 'LSB';
  if (band === '2m' || band === '70cm' || band === '23cm') return 'FM';
  return 'USB';
}

export const ANTENNAS = [
  'Dipole', 'End-Fed', 'Yagi', 'Mobile', 'Delta-Loop', 'Vertical', 'Other',
] as const;

export const SIGNAL_OPTIONS = [
  'Not Heard',
  '<5-5',
  '5-5',
  '5-6',
  '5-7',
  '5-8',
  '5-9',
  '5-9+10',
  '5-9+15',
  '5-9+20',
  '5-9+30',
] as const;

export const BAND_FREQ_RANGES: Record<string, { min: number; max: number }> = {
  '160m': { min: 1.8, max: 2.0 },
  '80m': { min: 3.5, max: 3.8 },
  '60m': { min: 5.25, max: 5.45 },
  '40m': { min: 7.0, max: 7.2 },
  '30m': { min: 10.1, max: 10.15 },
  '20m': { min: 14.0, max: 14.35 },
  '17m': { min: 18.068, max: 18.168 },
  '15m': { min: 21.0, max: 21.45 },
  '12m': { min: 24.89, max: 24.99 },
  '10m': { min: 28.0, max: 29.7 },
  '6m': { min: 50.0, max: 54.0 },
  '2m': { min: 144.0, max: 146.0 },
  '70cm': { min: 430.0, max: 440.0 },
  '23cm': { min: 1240.0, max: 1300.0 },
};

export interface CqSignalReport {
  id: string;
  session_id: string;
  reporter_callsign: string;
  signal_report: string;
  created_at: string;
}

export type NewCqSignalReport = Omit<CqSignalReport, 'id' | 'created_at' | 'session_id'>;

export interface Net {
  id: string;
  name: string;
  net_date: string;
  frequency: string;
  mode: string;
  created_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export type NewNet = Omit<Net, 'id' | 'created_at'>;

export interface NetParticipant {
  id: string;
  net_id: string;
  callsign: string;
  grid: string;
  city: string;
  antenna: string;
  power: string;
  created_at: string;
  is_proxy?: boolean;
  proxy_added_by?: string | null;
}

export type NewNetParticipant = Omit<NetParticipant, 'id' | 'created_at' | 'net_id'>;

export interface SignalReport {
  id: string;
  net_id: string;
  tx_callsign: string;
  rx_callsign: string;
  rst_report: string;
  created_at: string;
}

export type NewSignalReport = Omit<SignalReport, 'id' | 'created_at' | 'net_id'>;
