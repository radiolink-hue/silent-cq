import { getZonedCivilTime } from './netTime.ts';

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
    startHour: 18,
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

/**
 * Active public net for the banner / Publish form, using Asia/Jerusalem wall time.
 * Pass a UTC instant (server clock). Inclusive of the start and end minutes.
 */
export function getLiveNet(utcNow: Date): LiveNetSchedule | null {
  const civil = getZonedCivilTime(utcNow);
  const currentMinutes = civil.hour * 60 + civil.minute;

  for (const net of LIVE_NET_SCHEDULES) {
    if (net.dayOfWeek !== -1 && net.dayOfWeek !== civil.dayOfWeek) continue;
    const start = net.startHour * 60 + net.startMinute;
    const end = net.endHour * 60 + net.endMinute;
    if (currentMinutes >= start && currentMinutes <= end) {
      return net;
    }
  }
  return null;
}
