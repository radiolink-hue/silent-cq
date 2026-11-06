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

const SCHEDULE_IDS: LiveNetSchedule['id'][] = ['roundtable', 'gal', 'shabbat', 'allstar'];

export function scheduleIdForName(name: string): LiveNetSchedule['id'] | null {
  if (/allstar|אולסטאר/i.test(name)) return 'allstar';
  if (/shabbat|שבת/i.test(name)) return 'shabbat';
  if (/roundtable|שולחן/i.test(name)) return 'roundtable';
  if (/hagal|hameshudar|הגל|משודר/i.test(name)) return 'gal';
  return null;
}

export interface RecurringNetWindow {
  scheduleId: LiveNetSchedule['id'];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface NetScheduleTemplateRow {
  schedule_id: string;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
}

function parseHHMM(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
}

function clockMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Jerusalem start/end for one repeating net. End must be later the same civil day. */
export function recurringWindowFromClock(
  scheduleId: LiveNetSchedule['id'],
  startHHMM: string,
  endHHMM: string
): RecurringNetWindow | null {
  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  if (!start || !end) return null;
  if (clockMinutes(end.hour, end.minute) <= clockMinutes(start.hour, start.minute)) return null;
  return {
    scheduleId,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

export function recurringWindowFromRow(row: NetScheduleTemplateRow): RecurringNetWindow | null {
  if (!SCHEDULE_IDS.includes(row.schedule_id as LiveNetSchedule['id'])) return null;
  const startHour = Number(row.start_hour);
  const startMinute = Number(row.start_minute);
  const endHour = Number(row.end_hour);
  const endMinute = Number(row.end_minute);
  if ([startHour, startMinute, endHour, endMinute].some((n) => !Number.isInteger(n))) return null;
  if (clockMinutes(endHour, endMinute) <= clockMinutes(startHour, startMinute)) return null;
  return {
    scheduleId: row.schedule_id as LiveNetSchedule['id'],
    startHour,
    startMinute,
    endHour,
    endMinute,
  };
}

export function windowOnJerusalemDate(
  year: number,
  month: number,
  day: number,
  clock: Pick<RecurringNetWindow, 'startHour' | 'startMinute' | 'endHour' | 'endMinute'>
): { startsAt: string; endsAt: string } | null {
  const startsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, clock.startHour, clock.startMinute);
  const endsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, clock.endHour, clock.endMinute);
  if (endsAt.getTime() <= startsAt.getTime()) return null;
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

/** Jerusalem calendar date of a session. Prefer the stored start instant. */
export function netJerusalemDate(row: { starts_at?: string | null; net_date?: string }): string | null {
  if (row.starts_at) {
    const start = new Date(row.starts_at);
    if (!Number.isNaN(start.getTime())) return jerusalemDateString(start);
  }
  if (row.net_date && /^\d{4}-\d{2}-\d{2}$/.test(row.net_date)) return row.net_date;
  return null;
}

export interface RetimedNet {
  id: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Sessions of this net type whose Jerusalem date is today or later.
 * Earlier rows, including a historical date such as 28/10/2026, stay as recorded.
 */
export function planRecurringRetimes<T extends { id: string; name: string; starts_at?: string | null; net_date?: string }>(
  rows: T[],
  scheduleId: LiveNetSchedule['id'],
  clock: RecurringNetWindow,
  todayJerusalem: string
): RetimedNet[] {
  const planned: RetimedNet[] = [];
  for (const row of rows) {
    if (scheduleIdForName(row.name) !== scheduleId) continue;
    const date = netJerusalemDate(row);
    if (!date || date < todayJerusalem) continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) continue;
    const window = windowOnJerusalemDate(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      clock
    );
    if (!window) continue;
    planned.push({ id: row.id, startsAt: window.startsAt, endsAt: window.endsAt });
  }
  return planned;
}

export function mergeNetRows<T extends { id: string }>(...groups: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const row of group) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/**
 * Dropdown state after a recurring edit.
 * New times replace the matching rows, including when today's row was just inserted
 * and that id is already present. Past rows stay as they are.
 */
export function applyRetimedNets<
  T extends { id: string; name: string; net_date: string; starts_at?: string | null; ends_at?: string | null },
>(rows: T[], changes: RetimedNet[], inserted: T | null): T[] {
  const changeById = new Map(changes.map((change) => [change.id, change]));
  if (inserted?.starts_at && inserted.ends_at) {
    changeById.set(inserted.id, { id: inserted.id, startsAt: inserted.starts_at, endsAt: inserted.ends_at });
  }
  const seen = new Set<string>();
  const next: T[] = [];
  for (const row of inserted ? [...rows, inserted] : rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const change = changeById.get(row.id);
    next.push(change ? { ...row, starts_at: change.startsAt, ends_at: change.endsAt } : row);
  }
  return next.sort((a, b) => b.net_date.localeCompare(a.net_date) || a.name.localeCompare(b.name));
}

function withRecurringClock(net: LiveNetSchedule, recurring: RecurringNetWindow[]): LiveNetSchedule {
  const clock = recurring.find((window) => window.scheduleId === net.id);
  if (!clock) return net;
  return {
    ...net,
    startHour: clock.startHour,
    startMinute: clock.startMinute,
    endHour: clock.endHour,
    endMinute: clock.endMinute,
  };
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
 * A saved recurring template replaces the built-in clock for that net type,
 * including when today's row still has the previous start.
 * With no template, a saved `nets` row for today replaces the built-in clock.
 * Rows that are not today leave the built-in window in place.
 */
export function resolveLiveNet(
  utcNow: Date,
  saved: SavedNetWindow[] = [],
  recurring: RecurringNetWindow[] = []
): LiveNetSchedule | null {
  const schedules = LIVE_NET_SCHEDULES.map((net) => withRecurringClock(net, recurring));
  const templateIds = new Set(recurring.map((window) => window.scheduleId));
  const overridden = new Set<LiveNetSchedule['id']>();
  const activeIds = new Set<LiveNetSchedule['id']>();

  for (const row of saved) {
    if (!row.starts_at || !row.ends_at) continue;
    const id = scheduleIdForName(row.name);
    if (!id || templateIds.has(id) || !sameJerusalemDay(utcNow, row.starts_at)) continue;
    overridden.add(id);
    if (windowContains(utcNow, row.starts_at, row.ends_at)) activeIds.add(id);
  }

  for (const net of schedules) {
    if (activeIds.has(net.id)) return net;
  }

  const civil = getZonedCivilTime(utcNow);
  const currentMinutes = civil.hour * 60 + civil.minute;
  for (const net of schedules) {
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
  const startMatch = parseHHMM(startHHMM);
  const endMatch = parseHHMM(endHHMM);
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

  const startsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, startMatch.hour, startMatch.minute);
  const endsAt = zonedWallTimeToUtc(DISPLAY_TZ, year, month, day, endMatch.hour, endMatch.minute);
  if (endsAt.getTime() <= startsAt.getTime()) return null;
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function jerusalemTimeInputValue(utcInstant: Date | string): string {
  const date = typeof utcInstant === 'string' ? new Date(utcInstant) : utcInstant;
  if (Number.isNaN(date.getTime())) return '';
  const civil = getZonedCivilTime(date);
  return `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}`;
}
