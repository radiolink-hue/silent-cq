import { DISPLAY_TZ, getZonedCivilTime, jerusalemDateString, zonedWallTimeToUtc } from './netTime.ts';

export interface LiveNetSchedule {
  id: 'roundtable' | 'gal' | 'shabbat' | 'allstar';
  name: string;
  nameHe: string;
  dayOfWeek: number; // 0=Sunday ... 6=Saturday in Asia/Jerusalem; -1 = daily
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  band: string;
  frequency: string;
  mode: string;
  antenna: string;
  power: string;
  bannerClass: string;
}

/** Distinctive, readable colors for the always-on net banner. */
export const LIVE_NET_SCHEDULES: LiveNetSchedule[] = [
  {
    id: 'roundtable',
    name: 'Daily Roundtable Net',
    nameHe: 'השולחן העגול',
    dayOfWeek: -1,
    startHour: 17,
    startMinute: 25,
    endHour: 19,
    endMinute: 15,
    band: '40m',
    frequency: '7.165',
    mode: 'LSB',
    antenna: 'Dipole',
    power: '100',
    bannerClass: 'bg-amber-400 text-amber-950',
  },
  {
    id: 'gal',
    name: 'Hagal Hameshudar',
    nameHe: 'הגל המשודר',
    dayOfWeek: 2,
    startHour: 19,
    startMinute: 25,
    endHour: 20,
    endMinute: 30,
    band: '2m',
    frequency: '145.775',
    mode: 'FM',
    antenna: 'Vertical',
    power: '',
    bannerClass: 'bg-emerald-600 text-white',
  },
  {
    id: 'shabbat',
    name: 'Shabbat Morning Net',
    nameHe: 'רשת שבת',
    dayOfWeek: 6,
    startHour: 8,
    startMinute: 0,
    endHour: 12,
    endMinute: 0,
    band: '40m',
    frequency: '7.130',
    mode: 'LSB',
    antenna: 'Dipole',
    power: '100',
    bannerClass: 'bg-violet-700 text-white',
  },
  {
    id: 'allstar',
    name: 'Israel AllStar Link Net',
    nameHe: 'Israel AllStar Link Net',
    dayOfWeek: 4,
    startHour: 19,
    startMinute: 55,
    endHour: 21,
    endMinute: 0,
    band: '70cm',
    frequency: '430.9',
    mode: 'FM',
    antenna: 'Vertical',
    power: '',
    bannerClass: 'bg-sky-600 text-white',
  },
];

export interface SavedNetWindow {
  name: string;
  net_date?: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

const END_MINUTE_MS = 60_000;

function scheduleIdForName(name: string): LiveNetSchedule['id'] | null {
  if (/allstar|אולסטאר/i.test(name)) return 'allstar';
  if (/shabbat|שבת/i.test(name)) return 'shabbat';
  if (/roundtable|שולחן/i.test(name)) return 'roundtable';
  if (/hagal|hameshudar|הגל|משודר/i.test(name)) return 'gal';
  return null;
}

/** Inclusive of the end minute stored on the row. */
function windowContains(utcNow: Date, startsAt: string, endsAt: string): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const now = utcNow.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now < end + END_MINUTE_MS;
}

function sameJerusalemDay(utcNow: Date, startsAt: string): boolean {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return false;
  return jerusalemDateString(start) === jerusalemDateString(utcNow);
}

/**
 * Active public net for the banner / Publish form.
 * A saved `nets` row for today replaces the built-in clock for that net type,
 * so an admin edit (for example 17:25 → 16:25) is what every dashboard follows.
 * Rows that are not today leave the built-in window in place.
 */
export function resolveLiveNet(utcNow: Date, saved: SavedNetWindow[] = []): LiveNetSchedule | null {
  const overridden = new Set<LiveNetSchedule['id']>();
  const activeIds = new Set<LiveNetSchedule['id']>();

  for (const row of saved) {
    if (!row.starts_at || !row.ends_at) continue;
    const id = scheduleIdForName(row.name);
    if (!id || !sameJerusalemDay(utcNow, row.starts_at)) continue;
    overridden.add(id);
    if (windowContains(utcNow, row.starts_at, row.ends_at)) activeIds.add(id);
  }

  for (const net of LIVE_NET_SCHEDULES) {
    if (activeIds.has(net.id)) return net;
  }

  const civil = getZonedCivilTime(utcNow);
  const currentMinutes = civil.hour * 60 + civil.minute;
  for (const net of LIVE_NET_SCHEDULES) {
    if (overridden.has(net.id)) continue;
    if (net.dayOfWeek !== -1 && net.dayOfWeek !== civil.dayOfWeek) continue;
    const start = net.startHour * 60 + net.startMinute;
    const end = net.endHour * 60 + net.endMinute;
    if (currentMinutes >= start && currentMinutes <= end) return net;
  }
  return null;
}

/** Active public net from the built-in Asia/Jerusalem clock. Inclusive of the end minute. */
export function getLiveNet(utcNow: Date): LiveNetSchedule | null {
  return resolveLiveNet(utcNow);
}

/** Jerusalem wall times on the session's own date, as UTC instants. */
export function netWindowFromClock(
  anchor: { starts_at?: string | null; net_date?: string },
  startHHMM: string,
  endHHMM: string
): { startsAt: string; endsAt: string } | null {
  const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startHHMM.trim());
  const endMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endHHMM.trim());
  if (!startMatch || !endMatch) return null;

  let year: number;
  let month: number;
  let day: number;
  if (anchor.starts_at) {
    const start = new Date(anchor.starts_at);
    if (Number.isNaN(start.getTime())) return null;
    const civil = getZonedCivilTime(start);
    year = civil.year;
    month = civil.month;
    day = civil.day;
  } else if (anchor.net_date && /^\d{4}-\d{2}-\d{2}$/.test(anchor.net_date)) {
    const [y, m, d] = anchor.net_date.split('-').map((n) => parseInt(n, 10));
    year = y;
    month = m;
    day = d;
  } else {
    return null;
  }

  const startsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, parseInt(startMatch[1], 10), parseInt(startMatch[2], 10));
  const endsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, parseInt(endMatch[1], 10), parseInt(endMatch[2], 10));
  if (endsAt.getTime() <= startsAt.getTime()) return null;
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function jerusalemTimeInputValue(utcInstant: Date | string): string {
  const date = typeof utcInstant === 'string' ? new Date(utcInstant) : utcInstant;
  if (Number.isNaN(date.getTime())) return '';
  const civil = getZonedCivilTime(date);
  return `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}`;
}
