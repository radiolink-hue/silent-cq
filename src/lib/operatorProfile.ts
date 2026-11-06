import { ANTENNAS } from '../types.ts';

export const PROFILE_KEYS = {
  callsign: 'scq_callsign',
  gridsquare: 'scq_gridsquare',
  city: 'scq_city',
  power: 'scq_power',
  antenna: 'scq_antenna',
} as const;

export const DEFAULT_OPERATOR_POWER = 100;
export const MIN_OPERATOR_POWER = 1;
export const MAX_OPERATOR_POWER = 1500;
export const DEFAULT_OPERATOR_ANTENNA = 'Dipole';

export interface OperatorProfile {
  callsign: string;
  gridsquare: string;
  city: string;
  power: number;
  antenna: string;
}

export function trimProfileField(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Strict integer in 1–1500, or null if the value is not a valid power. */
export function parseOperatorPower(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < MIN_OPERATOR_POWER || value > MAX_OPERATOR_POWER) {
      return null;
    }
    return value;
  }
  const raw = trimProfileField(value);
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < MIN_OPERATOR_POWER || n > MAX_OPERATOR_POWER) return null;
  return n;
}

/** One of the Call Silent CQ antenna choices, or null when the value is unknown. */
export function normalizeOperatorAntenna(value: string | null | undefined): string | null {
  const trimmed = trimProfileField(value);
  return (ANTENNAS as readonly string[]).includes(trimmed) ? trimmed : null;
}

export function loadOperatorProfile(
  storage: Pick<Storage, 'getItem'> = localStorage
): OperatorProfile {
  return {
    callsign: trimProfileField(storage.getItem(PROFILE_KEYS.callsign)).toUpperCase(),
    gridsquare: trimProfileField(storage.getItem(PROFILE_KEYS.gridsquare)).toUpperCase(),
    city: trimProfileField(storage.getItem(PROFILE_KEYS.city)),
    power: parseOperatorPower(storage.getItem(PROFILE_KEYS.power)) ?? DEFAULT_OPERATOR_POWER,
    antenna: normalizeOperatorAntenna(storage.getItem(PROFILE_KEYS.antenna)) ?? DEFAULT_OPERATOR_ANTENNA,
  };
}

export function saveOperatorProfile(
  profile: Partial<OperatorProfile>,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  if (profile.callsign != null) storage.setItem(PROFILE_KEYS.callsign, profile.callsign.trim().toUpperCase());
  if (profile.gridsquare != null) storage.setItem(PROFILE_KEYS.gridsquare, profile.gridsquare.trim().toUpperCase());
  if (profile.city != null) storage.setItem(PROFILE_KEYS.city, profile.city.trim());
  if (profile.power != null) {
    const power = parseOperatorPower(profile.power);
    if (power != null) storage.setItem(PROFILE_KEYS.power, String(power));
  }
  if (profile.antenna != null) {
    const antenna = normalizeOperatorAntenna(profile.antenna);
    if (antenna != null) storage.setItem(PROFILE_KEYS.antenna, antenna);
  }
}

export function isProfileComplete(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && profile.city);
}

/** Callsign + grid are known; operator still needs to give a city. */
export function needsCityPrompt(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && !profile.city);
}
