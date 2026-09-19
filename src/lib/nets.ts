import {
  DISPLAY_TZ,
  getZonedCivilTime,
  jerusalemDateString,
  zonedWallTimeToUtc,
} from './netTime.ts';

export interface NetSchedule {
  id: string;
  name: string;
  nameHe: string;
  dayOfWeek: number; // 0=Sunday ... 6=Saturday in Asia/Jerusalem
  startHour: number; // wall-clock hour in Asia/Jerusalem
  startMinute: number;
  endHour: number;
  endMinute: number;
  band: string;
  mode: string;
  frequency: string;
  power: string;
  archivePrefix: string;
  isHF: boolean;
}

export const NET_SCHEDULES: NetSchedule[] = [
  {
    id: 'roundtable',
    name: 'Daily Roundtable Net',
    nameHe: 'שולחן עגול 40/60/80/6',
    dayOfWeek: -1, // daily
    startHour: 18,
    startMinute: 0,
    endHour: 19,
    endMinute: 15,
    band: '40m',
    mode: 'LSB',
    frequency: '7.165',
    power: '100W',
    archivePrefix: 'DAILY_ROUNDTABLE_NET',
    isHF: true,
  },
  {
    id: 'shabbat',
    name: 'Shabbat Morning Net',
    nameHe: 'רשת שבת',
    dayOfWeek: 6, // Saturday
    startHour: 7,
    startMinute: 30,
    endHour: 12,
    endMinute: 0,
    band: '40m',
    mode: 'LSB',
    frequency: '7.130',
    power: '100W',
    archivePrefix: 'SHABBAT_NET',
    isHF: true,
  },
  {
    id: 'gal',
    name: 'Gal Hameshudar Net',
    nameHe: 'גל המשודר',
    dayOfWeek: 2, // Tuesday
    startHour: 19,
    startMinute: 25,
    endHour: 20,
    endMinute: 30,
    band: '2m',
    mode: 'FM',
    frequency: '145.775',
    power: '100W',
    archivePrefix: 'GAL_HAMESHUDAR',
    isHF: false,
  },
  {
    id: 'allstar',
    name: 'Israel AllStar Link Net',
    nameHe: 'רשת אולסטאר ישראל',
    dayOfWeek: 4, // Thursday
    startHour: 19,
    startMinute: 55,
    endHour: 21,
    endMinute: 0,
    band: '70cm',
    mode: 'FM',
    frequency: '430.900',
    power: '100W',
    archivePrefix: 'ISRAEL_ALLSTAR_NET',
    isHF: false,
  },
];

export function getScheduleUtcWindow(
  schedule: NetSchedule,
  utcNow: Date
): { startsAt: Date; endsAt: Date } {
  const civil = getZonedCivilTime(utcNow);
  return {
    startsAt: zonedWallTimeToUtc(
      DISPLAY_TZ,
      civil.year,
      civil.month,
      civil.day,
      schedule.startHour,
      schedule.startMinute
    ),
    endsAt: zonedWallTimeToUtc(
      DISPLAY_TZ,
      civil.year,
      civil.month,
      civil.day,
      schedule.endHour,
      schedule.endMinute
    ),
  };
}

/**
 * Decide which scheduled net is live using a UTC instant (server clock).
 * Do not pass the browser's local clock.
 */
export function getActiveNet(utcNow: Date): NetSchedule | null {
  const civil = getZonedCivilTime(utcNow);
  const currentMinutes = civil.hour * 60 + civil.minute;

  for (const net of NET_SCHEDULES) {
    if (net.dayOfWeek !== -1 && net.dayOfWeek !== civil.dayOfWeek) continue;
    const start = net.startHour * 60 + net.startMinute;
    const end = net.endHour * 60 + net.endMinute;
    if (currentMinutes >= start && currentMinutes <= end) {
      return net;
    }
  }
  return null;
}

export function formatArchiveName(net: NetSchedule, utcNow: Date): string {
  const [yyyy, mm, dd] = jerusalemDateString(utcNow).split('-');
  return `${net.archivePrefix}_${dd}${mm}${yyyy}`;
}
