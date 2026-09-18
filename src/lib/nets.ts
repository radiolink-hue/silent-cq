export interface NetSchedule {
  id: string;
  name: string;
  nameHe: string;
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  startHour: number;
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

function getISTDate(): Date {
  // Use Intl API to get Israel local time (Asia/Jerusalem handles IST/IDT DST automatically)
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  // Build a Date as if the Israel-local values were UTC, then we compare only the local components
  return new Date(
    Date.UTC(
      parseInt(map.year),
      parseInt(map.month) - 1,
      parseInt(map.day),
      parseInt(map.hour === '24' ? '0' : map.hour),
      parseInt(map.minute),
      parseInt(map.second)
    )
  );
}

export function getActiveNet(): NetSchedule | null {
  const ist = getISTDate();
  const day = ist.getDay();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  for (const net of NET_SCHEDULES) {
    if (net.dayOfWeek !== -1 && net.dayOfWeek !== day) continue;
    const start = net.startHour * 60 + net.startMinute;
    const end = net.endHour * 60 + net.endMinute;
    if (currentMinutes >= start && currentMinutes <= end) {
      return net;
    }
  }
  return null;
}

export function formatArchiveName(net: NetSchedule, date?: Date): string {
  const d = date ?? getISTDate();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${net.archivePrefix}_${dd}${mm}${yyyy}`;
}
