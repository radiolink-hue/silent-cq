import type { Net, NetParticipant, SignalReport } from '../types.ts';
import { formatJerusalemTime } from './netTime.ts';

export const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

export const EXPORT_NET_FILTERS = [
  {
    id: 'roundtable',
    label: 'Daily Roundtable Net',
    matches: (name: string) => /roundtable/i.test(name),
  },
  {
    id: 'gal',
    label: 'Hagal Hameshudar',
    matches: (name: string) => /hagal|gal\s*hameshudar/i.test(name),
  },
  {
    id: 'shabbat',
    label: 'Shabbat Morning Net',
    matches: (name: string) => /shabbat/i.test(name),
  },
  {
    id: 'allstar',
    label: 'Israel AllStar Link Net',
    matches: (name: string) => /allstar/i.test(name),
  },
] as const;

export type ExportNetFilterId = (typeof EXPORT_NET_FILTERS)[number]['id'];

type JSZipCtor = new () => {
  file: (name: string, data: string) => void;
  generateAsync: (opts: { type: 'blob' }) => Promise<Blob>;
};

declare global {
  interface Window {
    JSZip?: JSZipCtor;
  }
}

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function csvFileName(netName: string, netDate: string): string {
  const stem = (netName.trim() || 'Net').replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
  return `${stem}_${netDate}.csv`;
}

export function uniqueCsvFileName(netName: string, netDate: string, used: Set<string>): string {
  const base = csvFileName(netName, netDate);
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  const dot = base.lastIndexOf('.');
  const stem = dot >= 0 ? base.slice(0, dot) : base;
  const ext = dot >= 0 ? base.slice(dot) : '';
  let n = 2;
  let candidate = `${stem}_${n}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}_${n}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function formatParticipantSignalReports(
  callsign: string,
  reports: SignalReport[]
): string {
  const cs = callsign.trim().toUpperCase();
  return reports
    .filter((r) => r.tx_callsign.trim().toUpperCase() === cs)
    .map((r) => `${r.rx_callsign.trim().toUpperCase()}→${r.rst_report.trim()}`)
    .join('; ');
}

export function stationsForNetExport(
  participants: NetParticipant[],
  reports: SignalReport[]
): { callsign: string; grid: string; city: string; power: string; antenna: string }[] {
  const byCall = new Map<
    string,
    { callsign: string; grid: string; city: string; power: string; antenna: string }
  >();

  const ensure = (raw: string) => {
    const callsign = raw.trim().toUpperCase();
    if (!callsign) return;
    if (!byCall.has(callsign)) {
      byCall.set(callsign, { callsign, grid: '', city: '', power: '', antenna: '' });
    }
  };

  for (const p of participants) {
    ensure(p.callsign);
    const row = byCall.get(p.callsign.trim().toUpperCase());
    if (!row) continue;
    row.grid = p.grid ?? '';
    row.city = p.city ?? '';
    row.power = p.power ?? '';
    row.antenna = p.antenna ?? '';
  }

  for (const r of reports) {
    ensure(r.tx_callsign);
    ensure(r.rx_callsign);
  }

  return [...byCall.values()].sort((a, b) => a.callsign.localeCompare(b.callsign));
}

export function netMatchesExportSelection(
  netName: string,
  allNets: boolean,
  selected: ReadonlySet<ExportNetFilterId>
): boolean {
  if (allNets) return true;
  return EXPORT_NET_FILTERS.some((f) => selected.has(f.id) && f.matches(netName));
}

export function buildNetSessionCsv(
  net: Pick<Net, 'name' | 'net_date' | 'starts_at' | 'created_at'>,
  participants: NetParticipant[],
  reports: SignalReport[]
): string {
  const date = net.net_date;
  const timeSource = net.starts_at || net.created_at;
  const time = timeSource ? formatJerusalemTime(timeSource) : '';
  const header = 'Date,Time,Callsign,Grid,City,Power,Antenna,Signal_Reports';
  const stations = stationsForNetExport(participants, reports);
  const rows = stations.map((p) =>
    [
      date,
      time,
      p.callsign,
      p.grid,
      p.city,
      p.power,
      p.antenna,
      formatParticipantSignalReports(p.callsign, reports),
    ]
      .map((cell) => csvEscape(String(cell)))
      .join(',')
  );
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

export async function loadJSZip(): Promise<JSZipCtor> {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error('JSZip failed to load'));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${JSZIP_CDN}"]`);
    if (existing) {
      if (window.JSZip) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = JSZIP_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = fail;
    document.head.appendChild(script);
  });
  if (!window.JSZip) throw new Error('JSZip failed to load');
  return window.JSZip;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function zipDownloadName(from: string, to: string): string {
  return `net_reports_${from}_to_${to}.zip`;
}
