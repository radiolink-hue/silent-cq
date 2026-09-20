import { useEffect, useMemo, useState } from 'react';
import { FileArchive, Loader2, X } from 'lucide-react';
import { Net } from '@/types';
import { useApp } from '@/context/AppContext';
import {
  EXPORT_NET_FILTERS,
  ExportNetFilterId,
  buildNetSessionCsv,
  downloadBlob,
  loadJSZip,
  netMatchesExportSelection,
  uniqueCsvFileName,
  zipDownloadName,
} from '@/lib/netReportExport';

interface ExportReportsDialogProps {
  open: boolean;
  today: string;
  minDate: string;
  onClose: () => void;
  fetchNetsInDateRange: (from: string, to: string) => Promise<Net[]>;
  fetchNetExportData: (
    netId: string
  ) => Promise<{ participants: import('@/types').NetParticipant[]; reports: import('@/types').SignalReport[] }>;
  onToast: (title: string, message: string, isError?: boolean) => void;
}

export default function ExportReportsDialog({
  open,
  today,
  minDate,
  onClose,
  fetchNetsInDateRange,
  fetchNetExportData,
  onToast,
}: ExportReportsDialogProps) {
  const { t } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allNets, setAllNets] = useState(true);
  const [selected, setSelected] = useState<Set<ExportNetFilterId>>(
    () => new Set(EXPORT_NET_FILTERS.map((f) => f.id))
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open || !today) return;
    setFrom((prev) => prev || today);
    setTo((prev) => prev || today);
  }, [open, today]);

  const canExport = useMemo(() => {
    if (!from || !to || from > to) return false;
    if (allNets) return true;
    return selected.size > 0;
  }, [allNets, from, to, selected]);

  if (!open) return null;

  const toggleAll = (checked: boolean) => {
    setAllNets(checked);
    setSelected(checked ? new Set(EXPORT_NET_FILTERS.map((f) => f.id)) : new Set());
  };

  const toggleType = (id: ExportNetFilterId, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
    setAllNets(next.size === EXPORT_NET_FILTERS.length);
  };

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const nets = await fetchNetsInDateRange(from, to);
      const chosen = nets.filter((n) =>
        netMatchesExportSelection(n.name || '', allNets, selected)
      );
      if (chosen.length === 0) {
        onToast(t('exportZipEmpty'), '', true);
        return;
      }

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const used = new Set<string>();
      for (const net of chosen) {
        const { participants, reports } = await fetchNetExportData(net.id);
        const csv = buildNetSessionCsv(net, participants, reports);
        zip.file(uniqueCsvFileName(net.name || net.frequency, net.net_date, used), csv);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, zipDownloadName(from, to));
      onToast(t('exportZipDone'), '');
      onClose();
    } catch {
      onToast(t('exportZipError'), '', true);
    } finally {
      setExporting(false);
    }
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-3xl glass-strong p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{t('exportReports')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="exportFrom">
              {t('exportFrom')}
            </label>
            <input
              id="exportFrom"
              type="date"
              value={from}
              min={minDate}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="exportTo">
              {t('exportTo')}
            </label>
            <input
              id="exportTo"
              type="date"
              value={to}
              min={from || minDate}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className={label}>{t('exportSelectNets')}</legend>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold dark:bg-white/5">
            <input
              type="checkbox"
              checked={allNets}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
            />
            {t('exportAllNets')}
          </label>
          {EXPORT_NET_FILTERS.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm dark:bg-transparent"
            >
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={(e) => toggleType(f.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
              />
              {f.label}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!canExport || exporting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileArchive className="h-5 w-5" />}
          {exporting ? t('exportZipExporting') : t('exportZip')}
        </button>
      </div>
    </div>
  );
}
