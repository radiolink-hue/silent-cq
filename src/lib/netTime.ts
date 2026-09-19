export const DISPLAY_TZ = 'Asia/Jerusalem';

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface CivilTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
}

function partsMap(utcInstant: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(utcInstant)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

function hourFromParts(map: Record<string, string>): number {
  return parseInt(map.hour === '24' ? '0' : map.hour, 10);
}

/** Offset such that zonedWall = utcInstant + offset. */
export function getTimeZoneOffsetMs(timeZone: string, utcInstant: Date): number {
  const map = partsMap(utcInstant, timeZone);
  const asUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    hourFromParts(map),
    parseInt(map.minute, 10),
    parseInt(map.second, 10)
  );
  return asUtc - utcInstant.getTime();
}

/** Convert a civil wall time in `timeZone` to a UTC instant. */
export function zonedWallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  let utcMs = utcGuess - offset;
  const offset2 = getTimeZoneOffsetMs(timeZone, new Date(utcMs));
  if (offset2 !== offset) {
    utcMs = utcGuess - offset2;
  }
  return new Date(utcMs);
}

export function getZonedCivilTime(utcNow: Date, timeZone: string = DISPLAY_TZ): CivilTime {
  const map = partsMap(utcNow, timeZone);
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  return {
    year,
    month,
    day,
    hour: hourFromParts(map),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    dayOfWeek: WEEKDAYS[map.weekday] ?? new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

export function jerusalemDateString(utcNow: Date): string {
  const c = getZonedCivilTime(utcNow);
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
}

export function utcDateString(utcInstant: Date): string {
  return utcInstant.toISOString().slice(0, 10);
}

export function formatJerusalemDateTime(utcInstant: Date | string): string {
  const date = typeof utcInstant === 'string' ? new Date(utcInstant) : utcInstant;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatJerusalemTime(utcInstant: Date | string): string {
  const date = typeof utcInstant === 'string' ? new Date(utcInstant) : utcInstant;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function jerusalemDateToUtcRange(isoDate: string): { start: Date; end: Date } {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  const start = zonedWallTimeToUtc(DISPLAY_TZ, y, m, d, 0, 0, 0);
  const end = zonedWallTimeToUtc(DISPLAY_TZ, y, m, d + 1, 0, 0, 0);
  return { start, end };
}
