import { useEffect, useState } from 'react';
import { Network, Plus, Trash2, Download, FileDown, FileArchive, Loader2, Users, Radio, MapPin, Zap, Antenna as AntennaIcon, X } from 'lucide-react';
import { BANDS, MODES, Net, NetParticipant, NewNet, NewNetParticipant, NewSignalReport, SignalReport } from '@/types';
import { useApp } from '@/context/AppContext';
import { downloadSignalMatrix, downloadNetPdf } from '@/lib/signalMatrix';
import ConfirmDialog from '@/components/ConfirmDialog';
import ExportReportsDialog from '@/components/ExportReportsDialog';
import CallsignLink from '@/components/CallsignLink';
import { getActiveNet } from '@/lib/nets';
import { useServerUtcNow } from '@/hooks/useServerUtcNow';
import { formatJerusalemDateTime, jerusalemDateString } from '@/lib/netTime';

interface NetManagerProps {
  nets: Net[];
  participants: NetParticipant[];
  reports: SignalReport[];
  loading: boolean;
  error: boolean;
  selectedNetId: string | null;
  onSelectNet: (id: string | null) => void;
  onCreateNet: (payload: NewNet) => Promise<{ error: boolean; net?: Net }>;
  onAddParticipant: (netId: string, payload: NewNetParticipant) => Promise<{ error: boolean; exists?: boolean }>;
  onAddReport: (netId: string, payload: NewSignalReport) => Promise<{ error: boolean; exists?: boolean }>;
  onDeleteNet: (netId: string) => Promise<boolean>;
  onDeleteParticipant: (participantId: string) => Promise<boolean>;
  onDeleteReport: (reportId: string) => Promise<boolean>;
  fetchNetsByDate: (date: string) => Promise<Net[]>;
  fetchNetsInDateRange: (from: string, to: string) => Promise<Net[]>;
  fetchNetExportData: (netId: string) => Promise<{ participants: NetParticipant[]; reports: SignalReport[] }>;
  isAdmin?: boolean;
  onToast: (title: string, message: string, isError?: boolean) => void;
}

const emptyNet: NewNet = {
  name: '',
  net_date: '',
  frequency: '',
  mode: 'USB',
};

const emptyParticipant: NewNetParticipant = {
  callsign: '',
  grid: '',
  city: '',
  antenna: '',
  power: '',
};

const emptyReport: NewSignalReport = {
  tx_callsign: '',
  rx_callsign: '',
  rst_report: '',
};

export default function NetManager({
  nets,
  participants,
  reports,
  loading,
  error,
  selectedNetId,
  onSelectNet,
  onCreateNet,
  onAddParticipant,
  onAddReport,
  onDeleteNet,
  onDeleteParticipant,
  onDeleteReport,
  fetchNetsByDate,
  fetchNetsInDateRange,
  fetchNetExportData,
  isAdmin,
  onToast,
}: NetManagerProps) {
  const { t } = useApp();
  const utcNow = useServerUtcNow();
  const [showCreate, setShowCreate] = useState(false);
  const [netForm, setNetForm] = useState<NewNet>(emptyNet);
  const [creating, setCreating] = useState(false);
  const [showAddP, setShowAddP] = useState(false);
  const [pForm, setPForm] = useState<NewNetParticipant>(emptyParticipant);
  const [showAddR, setShowAddR] = useState(false);
  const [rForm, setRForm] = useState<NewSignalReport>(emptyReport);
  const [pendingNetDelete, setPendingNetDelete] = useState<Net | null>(null);

  const today = utcNow ? jerusalemDateString(utcNow) : '';
  const minDate = utcNow
    ? jerusalemDateString(new Date(utcNow.getTime() - 30 * 24 * 60 * 60 * 1000))
    : '';
  const [exportDate, setExportDate] = useState('');
  const [dateFilteredNets, setDateFilteredNets] = useState<Net[]>([]);
  const [exportNetId, setExportNetId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [loadingDateNets, setLoadingDateNets] = useState(false);
  const [showExportReports, setShowExportReports] = useState(false);

  const selectedNet = nets.find((n) => n.id === selectedNetId) ?? null;
  const isHFNet = selectedNet ? !['FM', 'FT8', 'FT4', 'VARAC', 'SATELLITE', 'DIGITAL VOICE'].includes(selectedNet.mode) : true;

  useEffect(() => {
    if (!today) return;
    setExportDate((prev) => prev || today);
    setNetForm((f) => (f.net_date ? f : { ...f, net_date: today }));
    void handleDateChange(today);
  }, [today]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await onCreateNet(netForm);
    setCreating(false);
    if (res.error) {
      onToast(t('netExportError'), '', true);
    } else {
      setNetForm({ ...emptyNet, net_date: today });
      setShowCreate(false);
    }
  };

  const handleAddP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNetId) return;
    const res = await onAddParticipant(selectedNetId, {
      ...pForm,
      callsign: pForm.callsign.trim().toUpperCase(),
    });
    if (res.error) {
      if (res.exists) onToast(t('netParticipantExists'), pForm.callsign, true);
      return;
    }
    setPForm(emptyParticipant);
    setShowAddP(false);
  };

  const handleAddR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNetId) return;
    const res = await onAddReport(selectedNetId, {
      ...rForm,
      tx_callsign: rForm.tx_callsign.trim().toUpperCase(),
      rx_callsign: rForm.rx_callsign.trim().toUpperCase(),
    });
    if (res.error) {
      if (res.exists) onToast(t('netReportExists'), `${rForm.tx_callsign} → ${rForm.rx_callsign}`, true);
      return;
    }
    setRForm(emptyReport);
    setShowAddR(false);
  };

  const handleDateChange = async (date: string) => {
    setExportDate(date);
    setExportNetId('');
    if (!date) {
      setDateFilteredNets([]);
      return;
    }
    setLoadingDateNets(true);
    const result = await fetchNetsByDate(date);
    setDateFilteredNets(result);
    setLoadingDateNets(false);
  };

  const handleFilteredExport = async () => {
    if (!exportNetId) return;
    setExporting(true);
    const net = dateFilteredNets.find((n) => n.id === exportNetId);
    if (!net) {
      setExporting(false);
      return;
    }
    const { participants: exportP, reports: exportR } = await fetchNetExportData(exportNetId);
    const ok = downloadNetPdf(net, exportP, exportR);
    onToast(ok ? t('netPdfDone') : t('netPdfError'), '', !ok);
    setExporting(false);
  };

  const handleDeleteNet = async () => {
    const net = pendingNetDelete;
    setPendingNetDelete(null);
    if (!net) return;
    const ok = await onDeleteNet(net.id);
    onToast(ok ? t('netDeleteSuccess') : t('netDeleteError'), net.name || net.frequency, !ok);
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl glass py-16 text-center text-slate-500">
        <p className="font-semibold">{t('loadError')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Net toggle */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Network className="h-5 w-5 text-brand-500" />
          {t('netManager')}
        </h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isAdmin && (
            <button
              type="button"
              id="net-export-reports"
              onClick={() => setShowExportReports(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-95"
            >
              <FileArchive className="h-4 w-4" />
              {t('exportReports')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95"
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? t('cancel') : t('netCreateTitle')}
          </button>
        </div>
      </div>

      {/* Create Net form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-3xl glass p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="netName">{t('netName')}</label>
              <input
                id="netName"
                value={netForm.name}
                onChange={(e) => setNetForm((f) => ({ ...f, name: e.target.value }))}
                className={field}
                placeholder="Morning Net"
              />
            </div>
            <div>
              <label className={label} htmlFor="netDate">{t('netDate')}</label>
              <input
                id="netDate"
                type="date"
                value={netForm.net_date}
                onChange={(e) => setNetForm((f) => ({ ...f, net_date: e.target.value }))}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="netFreq">{t('netFrequency')}</label>
              <input
                id="netFreq"
                value={netForm.frequency}
                onChange={(e) => setNetForm((f) => ({ ...f, frequency: e.target.value }))}
                placeholder="7.130"
                inputMode="decimal"
                className={`${field} font-mono`}
              />
            </div>
            <div>
              <label className={label} htmlFor="netMode">{t('netMode')}</label>
              <select
                id="netMode"
                value={netForm.mode}
                onChange={(e) => setNetForm((f) => ({ ...f, mode: e.target.value }))}
                className={field}
              >
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-70"
          >
            {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            {creating ? t('netCreating') : t('netCreate')}
          </button>
        </form>
      )}

      {/* Net selector */}
      {nets.length > 0 && (
        <div>
          <label className={label} htmlFor="netSelect">{t('netSelect')}</label>
          <select
            id="netSelect"
            value={selectedNetId ?? ''}
            onChange={(e) => onSelectNet(e.target.value || null)}
            className={field}
          >
            <option value="">—</option>
            {nets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name || n.frequency} · {n.starts_at ? formatJerusalemDateTime(n.starts_at) : n.net_date} · {n.frequency} {n.mode}
              </option>
            ))}
          </select>
        </div>
      )}

      {nets.length === 0 && !showCreate && (
        <div className="flex flex-col items-center gap-3 rounded-3xl glass px-6 py-16 text-center text-slate-500 dark:text-slate-400">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500/10 text-brand-500">
            <Network className="h-8 w-8" />
          </div>
          <p className="max-w-xs font-medium">{t('netNone')}</p>
        </div>
      )}

      {/* Selected net details */}
      {selectedNet && (
        <div className="space-y-4">
          {/* Net header + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl glass p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  {selectedNet.name || `${selectedNet.frequency} ${selectedNet.mode}`}
                </h3>
                {utcNow && getActiveNet(utcNow) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {t('netAutoSynced')}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {(selectedNet.starts_at ? formatJerusalemDateTime(selectedNet.starts_at) : selectedNet.net_date)} · {selectedNet.frequency} MHz · {selectedNet.mode}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingNetDelete(selectedNet)}
                className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-2 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                aria-label={t('netDelete')}
                title={t('netDelete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Participants section */}
          <div className="rounded-3xl glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4 text-brand-500" />
                {t('netParticipants')} ({participants.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddP((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-500/25 dark:text-brand-300"
              >
                {showAddP ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddP ? t('cancel') : t('netAddParticipant')}
              </button>
            </div>

            {showAddP && (
              <form onSubmit={handleAddP} className="mb-3 space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={pForm.callsign}
                    onChange={(e) => setPForm((f) => ({ ...f, callsign: e.target.value }))}
                    placeholder={t('callsign')}
                    className={`${field} font-mono`}
                    required
                  />
                  <input
                    value={pForm.grid}
                    onChange={(e) => setPForm((f) => ({ ...f, grid: e.target.value }))}
                    placeholder={t('grid')}
                    className={`${field} font-mono`}
                  />
                  <input
                    value={pForm.city}
                    onChange={(e) => setPForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder={t('city')}
                    className={field}
                  />
                  <input
                    value={pForm.power}
                    onChange={(e) => setPForm((f) => ({ ...f, power: e.target.value }))}
                    placeholder={t('powerWatts')}
                    className={field}
                  />
                  <input
                    value={pForm.antenna}
                    onChange={(e) => setPForm((f) => ({ ...f, antenna: e.target.value }))}
                    placeholder={t('antennaField')}
                    className={field}
                  />
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  {t('netAddParticipant')}
                </button>
              </form>
            )}

            {participants.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('netNoParticipants')}</p>
            ) : (
              <div className="space-y-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <CallsignLink callsign={p.callsign} />
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {p.grid && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.grid}</span>}
                        {p.city && <span>{p.city}</span>}
                        {p.power && <span className="flex items-center gap-0.5"><Zap className="h-3 w-3" />{p.power}</span>}
                        {p.antenna && <span className="flex items-center gap-0.5"><AntennaIcon className="h-3 w-3" />{p.antenna}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteParticipant(p.id)}
                      className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                      aria-label={t('netDeleteParticipant')}
                      title={t('netDeleteParticipant')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signal Reports section — only for HF SSB nets */}
          {isHFNet ? (
          <div className="rounded-3xl glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <Radio className="h-4 w-4 text-brand-500" />
                {t('netSignalReports')} ({reports.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddR((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-500/25 dark:text-brand-300"
              >
                {showAddR ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddR ? t('cancel') : t('netAddReport')}
              </button>
            </div>

            {showAddR && (
              <form onSubmit={handleAddR} className="mb-3 space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className={label}>{t('netTx')}</label>
                    <input
                      list="participant-callsigns"
                      value={rForm.tx_callsign}
                      onChange={(e) => setRForm((f) => ({ ...f, tx_callsign: e.target.value }))}
                      placeholder={t('callsign')}
                      className={`${field} font-mono`}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>{t('netRx')}</label>
                    <input
                      list="participant-callsigns"
                      value={rForm.rx_callsign}
                      onChange={(e) => setRForm((f) => ({ ...f, rx_callsign: e.target.value }))}
                      placeholder={t('callsign')}
                      className={`${field} font-mono`}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>{t('netRst')}</label>
                    <input
                      value={rForm.rst_report}
                      onChange={(e) => setRForm((f) => ({ ...f, rst_report: e.target.value }))}
                      placeholder="59"
                      className={`${field} font-mono`}
                      required
                    />
                  </div>
                </div>
                <datalist id="participant-callsigns">
                  {participants.map((p) => <option key={p.id} value={p.callsign} />)}
                </datalist>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  {t('netAddReport')}
                </button>
              </form>
            )}

            {reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('netNoReports')}</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <CallsignLink callsign={r.tx_callsign} className="text-sm" />
                      <span className="text-slate-400">→</span>
                      <CallsignLink callsign={r.rx_callsign} className="text-sm" />
                      <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-mono text-xs font-bold text-brand-600 dark:text-brand-300">
                        {r.rst_report}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteReport(r.id)}
                      className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                      aria-label={t('netDeleteReport')}
                      title={t('netDeleteReport')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : (
            <div className="rounded-3xl glass p-4">
              <p className="py-4 text-center text-sm font-semibold text-slate-400">{t('fmNetNoReports')}</p>
            </div>
          )}
        </div>
      )}

      {/* Export Section */}
      <div className="rounded-3xl glass p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Download className="h-4 w-4 text-emerald-500" />
          {t('exportSection')}
        </h4>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="exportDate">{t('exportSelectDate')}</label>
            <input
              id="exportDate"
              type="date"
              value={exportDate}
              min={minDate}
              max={today}
              onChange={(e) => handleDateChange(e.target.value)}
              className={field}
            />
          </div>
          {loadingDateNets ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            </div>
          ) : dateFilteredNets.length > 0 ? (
            <div>
              <label className={label} htmlFor="exportNetSelect">{t('exportSelectNet')}</label>
              <select
                id="exportNetSelect"
                value={exportNetId}
                onChange={(e) => setExportNetId(e.target.value)}
                className={field}
              >
                <option value="">—</option>
                {dateFilteredNets.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name || n.frequency} · {n.frequency} {n.mode}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            exportDate && (
              <p className="py-2 text-center text-sm text-slate-400">{t('exportNoNetsForDate')}</p>
            )
          )}
          <button
            type="button"
            onClick={handleFilteredExport}
            disabled={!exportNetId || exporting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
            {exporting ? t('netCreating') : t('downloadPdfBtn')}
          </button>
        </div>
      </div>

      <ExportReportsDialog
        open={showExportReports}
        today={today}
        minDate={minDate}
        onClose={() => setShowExportReports(false)}
        fetchNetsInDateRange={fetchNetsInDateRange}
        fetchNetExportData={fetchNetExportData}
        onToast={onToast}
      />
      <ConfirmDialog
        open={!!pendingNetDelete}
        title={t('netDelete')}
        message={t('netDeleteConfirm')}
        confirmLabel={t('confirmDelete')}
        cancelLabel={t('cancel')}
        onConfirm={handleDeleteNet}
        onCancel={() => setPendingNetDelete(null)}
      />
    </div>
  );
}
