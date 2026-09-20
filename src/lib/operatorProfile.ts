export const PROFILE_KEYS = {
  callsign: 'scq_callsign',
  gridsquare: 'scq_gridsquare',
  city: 'scq_city',
  power: 'scq_power',
} as const;

export const DEFAULT_OPERATOR_POWER = 100;
export const MIN_OPERATOR_POWER = 1;
export const MAX_OPERATOR_POWER = 1500;

export interface OperatorProfile {
  callsign: string;
  gridsquare: string;
  city: string;
  power: number;
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

export function loadOperatorProfile(
  storage: Pick<Storage, 'getItem'> = localStorage
): OperatorProfile {
  return {
    callsign: trimProfileField(storage.getItem(PROFILE_KEYS.callsign)).toUpperCase(),
    gridsquare: trimProfileField(storage.getItem(PROFILE_KEYS.gridsquare)).toUpperCase(),
    city: trimProfileField(storage.getItem(PROFILE_KEYS.city)),
    power: parseOperatorPower(storage.getItem(PROFILE_KEYS.power)) ?? DEFAULT_OPERATOR_POWER,
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
}

export function isProfileComplete(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && profile.city);
}

/** Callsign + grid are known; operator still needs to give a city. */
export function needsCityPrompt(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && !profile.city);
}
