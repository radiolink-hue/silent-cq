// Hebrew-to-English translation map for common UI strings that may appear in PDF exports.
const HE_TO_EN: Record<string, string> = {
  'תחנות פעילות': 'Active Stations',
  'שולחן עגול': 'Roundtable Net',
  'שבת': 'Shabbat',
  'דוח 24 השעות האחרונות': 'Last 24 Hours Report',
  'אות קריאה': 'Callsign',
  'שעה': 'Time',
  'תדר': 'Band',
  'מדווחים': 'Reporting Station(s)',
  'מדווחים/דוח': 'Signal Report / Details',
  'REPORT': 'REPORT',
  'רשתות': 'Nets',
  'ניהול רשת': 'Net Manager',
  'משתתפים': 'Participants',
  'דוחות אות': 'Signal Reports',
  'משדר': 'TX',
  'מקלט': 'RX',
  'ריבוע': 'Grid',
  'עיר': 'City',
  'הספק': 'Power',
  'אנטנה': 'Antenna',
  'הערות': 'Comments',
  'מחיקת דוח': 'Delete Report',
  'דוח אות': 'Signal Report',
};

// Transliterate common Hebrew letters to ASCII (basic phonetic mapping).
const HEBREW_TRANSLIT: Record<string, string> = {
  'א': '', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ה': 'H', 'ו': 'V', 'ז': 'Z',
  'ח': 'Ch', 'ט': 'T', 'י': 'Y', 'כ': 'K', 'ך': 'K', 'ל': 'L', 'מ': 'M',
  'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S', 'ע': '', 'פ': 'P', 'ף': 'P',
  'צ': 'Ts', 'ץ': 'Ts', 'ק': 'K', 'ר': 'R', 'ש': 'Sh', 'ת': 'T',
};

/**
 * Sanitize text for PDF export:
 * 1. Translate known Hebrew UI strings to English.
 * 2. Transliterate remaining Hebrew characters to ASCII phonetics.
 * 3. Strip any remaining non-ASCII characters.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return '';

  // Check for exact Hebrew phrase match first
  const trimmed = text.trim();
  if (HE_TO_EN[trimmed]) return HE_TO_EN[trimmed];

  // Check if the text contains any Hebrew characters
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  let result = text;

  if (hasHebrew) {
    // Transliterate Hebrew characters
    result = result.replace(/[\u0590-\u05FF]/g, (ch) => HEBREW_TRANSLIT[ch] ?? '');
    // Clean up double spaces from removed aleph/ayin
    result = result.replace(/\s+/g, ' ').trim();
  }

  // Strip any remaining non-ASCII characters
  result = result.replace(/[^\x20-\x7E]/g, '');

  // Collapse multiple spaces
  return result.replace(/\s+/g, ' ').trim();
}

/** Format a date for PDF: YYYY-MM-DD */
export function pdfDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Format a time for PDF: HH:MM (24h, UTC) */
export function pdfTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}
