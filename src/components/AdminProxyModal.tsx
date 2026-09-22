import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Send, Shield, X } from 'lucide-react';
import { BANDS, MODES, NewCqSession, defaultModeForBand } from '@/types';
import { useApp } from '@/context/AppContext';
import { gridToLatLng } from '@/lib/maidenhead';
import type { LiveNetSchedule } from '@/lib/liveNetSchedule';
import { fetchLookupTable, searchLookupTable, type LookupEntry } from '@/utils/lookupTable';

interface AdminProxyModalProps {
  open: boolean;
  onClose: () => void;
  liveNet: LiveNetSchedule | null;
  onSubmit: (payload: NewCqSession) => Promise<{ error: boolean; selfReported?: boolean }>;
}

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export default function AdminProxyModal({ open, onClose, liveNet, onSubmit }: AdminProxyModalProps) {
  const { t } = useApp();
  const [entries, setEntries] = useState<LookupEntry[]>([]);
  const [callsign, setCallsign] = useState('');
  const [name, setName] = useState('');
  const [gridSquare, setGridSquare] = useState('');
  const [city, setCity] = useState('');
  const [power, setPower] = useState('');
  const [antenna, setAntenna] = useState('');
  const [band, setBand] = useState('40m');
  const [frequency, setFrequency] = useState('7.165');
  const [mode, setMode] = useState('LSB');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastAutoFill = useRef('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchLookupTable()
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCallsign('');
    setName('');
    setGridSquare('');
    setCity('');
    setPower('');
    setAntenna('');
    setBand(liveNet?.band ?? '40m');
    setFrequency(liveNet?.frequency ?? '7.165');
    setMode(liveNet?.mode ?? 'LSB');
    setError('');
    setPickerOpen(false);
    lastAutoFill.current = '';
  }, [open, liveNet]);

  const matches = useMemo(() => {
    const q = callsign.trim();
    if (q.length < 2) return [];
    return searchLookupTable(entries, q);
  }, [entries, callsign]);

  useEffect(() => {
    if (callsign.trim().length < 2) {
      lastAutoFill.current = '';
      setPickerOpen(false);
      return;
    }
    if (matches.length === 1) {
      const entry = matches[0];
      if (lastAutoFill.current !== entry.callsign) {
        lastAutoFill.current = entry.callsign;
        applyEntry(entry);
      }
      setPickerOpen(false);
      return;
    }
    lastAutoFill.current = '';
    setPickerOpen(matches.length > 1);
  }, [matches, callsign]);

  function applyEntry(entry: LookupEntry) {
    setCallsign(entry.callsign);
    setName(entry.name);
    setGridSquare(entry.gridSquare);
    setCity(entry.city);
    setPower(entry.maxPower || '');
    setAntenna(entry.antenna || '');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cs = callsign.trim().toUpperCase();
    if (!cs) {
      setError(t('callsignRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    const coords = gridToLatLng(gridSquare);
    const payload: NewCqSession = {
      callsign: cs,
      gridsquare: gridSquare.trim().toUpperCase(),
      band,
      mode,
      frequency: frequency.trim(),
      power: power.trim(),
      antenna: antenna.trim(),
      city: city.trim(),
      country: '',
      comments: name.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
    const res = await onSubmit(payload);
    setSubmitting(false);
    if (res.selfReported) {
      setError(t('adminProxySelfReported'));
      return;
    }
    if (res.error) {
      setError(t('reportError'));
      return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-fade-up rounded-3xl glass-strong p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{t('adminPosted')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-amber-500 px-3.5 py-3 text-amber-950 shadow-lg shadow-amber-500/20">
          <p className="flex items-start gap-2 text-sm font-bold">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This Silent CQ is being published by the admin on behalf of another station</span>
          </p>
          <p className="mt-1 pe-6 text-xs font-semibold">פרסום זה מתבצע על ידי המנהל בשם תחנה אחרת</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label className={label} htmlFor="proxy-callsign">{t('callsign')}</label>
            <input
              id="proxy-callsign"
              value={callsign}
              onChange={(e) => {
                setCallsign(e.target.value.toUpperCase());
                setError('');
              }}
              className={`${field} font-mono text-lg tracking-wider`}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {pickerOpen && matches.length > 1 && (
              <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
                {matches.map((entry) => (
                  <li key={entry.callsign}>
                    <button
                      type="button"
                      onClick={() => {
                        lastAutoFill.current = entry.callsign;
                        applyEntry(entry);
                        setPickerOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-amber-50 dark:hover:bg-white/10"
                    >
                      <span className="font-mono font-bold">{entry.callsign}</span>
                      <span className="truncate ps-3 text-xs text-slate-500">{entry.name || entry.city}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className={label} htmlFor="proxy-name">{t('qrzName')}</label>
            <input id="proxy-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="proxy-grid">{t('gridsquare')}</label>
              <input
                id="proxy-grid"
                value={gridSquare}
                onChange={(e) => setGridSquare(e.target.value)}
                className={`${field} font-mono`}
              />
            </div>
            <div>
              <label className={label} htmlFor="proxy-city">{t('city')}</label>
              <input id="proxy-city" value={city} onChange={(e) => setCity(e.target.value)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="proxy-power">{t('powerWatts')}</label>
              <input
                id="proxy-power"
                value={power}
                onChange={(e) => setPower(e.target.value)}
                inputMode="numeric"
                className={`${field} font-mono`}
              />
            </div>
            <div>
              <label className={label} htmlFor="proxy-antenna">{t('antennaField')}</label>
              <input id="proxy-antenna" value={antenna} onChange={(e) => setAntenna(e.target.value)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="proxy-band">{t('band')}</label>
              <select
                id="proxy-band"
                value={band}
                onChange={(e) => {
                  const next = e.target.value;
                  setBand(next);
                  setMode(defaultModeForBand(next));
                }}
                className={field}
              >
                {BANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="proxy-freq">{t('frequency')}</label>
              <input
                id="proxy-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                inputMode="decimal"
                className={`${field} font-mono`}
              />
            </div>
            <div>
              <label className={label} htmlFor="proxy-mode">{t('mode')}</label>
              <select id="proxy-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={field}>
                {MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 hover:text-white active:scale-[0.99] disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {submitting ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
