export const PROFILE_KEYS = {
  callsign: 'scq_callsign',
  gridsquare: 'scq_gridsquare',
  city: 'scq_city',
} as const;

export interface OperatorProfile {
  callsign: string;
  gridsquare: string;
  city: string;
}

export function trimProfileField(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function loadOperatorProfile(
  storage: Pick<Storage, 'getItem'> = localStorage
): OperatorProfile {
  return {
    callsign: trimProfileField(storage.getItem(PROFILE_KEYS.callsign)).toUpperCase(),
    gridsquare: trimProfileField(storage.getItem(PROFILE_KEYS.gridsquare)).toUpperCase(),
    city: trimProfileField(storage.getItem(PROFILE_KEYS.city)),
  };
}

export function saveOperatorProfile(
  profile: Partial<OperatorProfile>,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  if (profile.callsign != null) storage.setItem(PROFILE_KEYS.callsign, profile.callsign.trim().toUpperCase());
  if (profile.gridsquare != null) storage.setItem(PROFILE_KEYS.gridsquare, profile.gridsquare.trim().toUpperCase());
  if (profile.city != null) storage.setItem(PROFILE_KEYS.city, profile.city.trim());
}

export function isProfileComplete(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && profile.city);
}

/** Callsign + grid are known; operator still needs to give a city. */
export function needsCityPrompt(profile: OperatorProfile): boolean {
  return Boolean(profile.callsign && profile.gridsquare && !profile.city);
}
