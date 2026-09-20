import { useEffect, useState } from 'react';
import { Radio, Loader2, Send, Info, RadioTower, Activity } from 'lucide-react';
import { BANDS, MODES, ANTENNAS, BAND_FREQ_RANGES, NewCqSession, defaultModeForBand } from '@/types';
import { useApp } from '@/context/AppContext';
import { gridToLatLng } from '@/lib/maidenhead';
import type { LiveNetSchedule } from '@/lib/liveNetSchedule';
import type { CatTelemetry } from '@/hooks/useCatControl';

interface CallCqFormProps {
  onSubmit: (payload: NewCqSession) => Promise<{ error: boolean }>;
  onSuccess: () => void;
  myCallsign: string;
  myGridsquare: string;
  myCity: string;
  myPower: string;
  liveNet: LiveNetSchedule | null;
  catTelemetry: CatTelemetry | null;
  catConnected: boolean;
  vfoMoving: boolean;
  settlingSeconds: number;
}

const emptyDefaults = {
  band: '40m',
  mode: 'LSB',
  frequency: '7.165',
  antenna: 'Dipole',
  comments: '',
};

function emptyForm(power: string, city: string) {
  return {
    ...emptyDefaults,
    power,
    city,
  };
}

export default function CallCqForm({
  onSubmit,
  onSuccess,
  myCallsign,
  myGridsquare,
  myCity,
  myPower,
  liveNet,
  catTelemetry,
  catConnected,
  vfoMoving,
  settlingSeconds,
}: CallCqFormProps) {
  const { t } = useApp();
  const [form, setForm] = useState(() => emptyForm(myPower, myCity));
  const [gridsquare, setGridsquare] = useState(myGridsquare);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setGridsquare(myGridsquare);
    setForm((f) => ({ ...f, city: f.city || myCity }));
  }, [myGridsquare, myCity]);

  useEffect(() => {
    if (liveNet) return;
    if (!myPower) return;
    setForm((f) => (f.power === myPower ? f : { ...f, power: myPower }));
  }, [myPower, liveNet]);

  useEffect(() => {
    if (!liveNet) return;
    setForm((f) => ({
      ...f,
      band: liveNet.band,
      mode: liveNet.mode,
      frequency: liveNet.frequency,
      power: liveNet.power,
      antenna: liveNet.antenna,
    }));
  }, [liveNet]);

  useEffect(() => {
    if (!catConnected || !catTelemetry) return;
    setForm((f) => ({
      ...f,
      ...(catTelemetry.band && { band: catTelemetry.band }),
      ...(catTelemetry.mode && MODES.includes(catTelemetry.mode as typeof MODES[number]) && { mode: catTelemetry.mode }),
      ...(catTelemetry.frequency && { frequency: catTelemetry.frequency }),
      ...(catTelemetry.power && { power: catTelemetry.power }),
    }));
  }, [catConnected, catTelemetry]);

  useEffect(() => {
    const nextMode = defaultModeForBand(form.band);
    setForm((f) => (f.mode === nextMode ? f : { ...f, mode: nextMode }));
  }, [form.band]);

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validateFreq = (freq: string, band: string): boolean => {
    const f = parseFloat(freq);
    if (isNaN(f)) return false;
    const range = BAND_FREQ_RANGES[band];
    if (!range) return true;
    return f >= range.min && f <= range.max;
  };

  const validatePower = (power: string): boolean => {
    const p = parseInt(power, 10);
    if (isNaN(p)) return false;
    return p >= 1 && p <= 1500;
  };

  const doSubmit = async (payload: NewCqSession): Promise<boolean> => {
    const res = await onSubmit(payload);
    return !res.error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};

    if (!gridsquare.trim()) newErrors.gridsquare = true;
    if (!form.frequency.trim() || !validateFreq(form.frequency, form.band)) newErrors.frequency = true;
    if (!form.power.trim() || !validatePower(form.power)) newErrors.power = true;
    if (!form.city.trim()) newErrors.city = true;

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);

    const coords = gridToLatLng(gridsquare);
    const payload: NewCqSession = {
      callsign: myCallsign,
      gridsquare: gridsquare.trim().toUpperCase(),
      band: form.band,
      mode: form.mode,
      frequency: form.frequency.trim(),
      power: form.power.trim(),
      antenna: form.antenna,
      city: form.city.trim(),
      country: '',
      comments: form.comments.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };

    const ok = await doSubmit(payload);
    setSubmitting(false);
    if (ok) {
      setForm(emptyForm(myPower, payload.city.trim() || myCity));
      setGridsquare(payload.gridsquare.trim().toUpperCase() || myGridsquare);
      onSuccess();
    }
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';
  const errClass = 'border-red-400 ring-2 ring-red-400/30';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl glass p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <Radio className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">{t('formTitle')}</h2>
        </div>

        {liveNet && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-brand-500/10 px-3.5 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <div>
              <p className="text-sm font-bold text-brand-700 dark:text-brand-300">
                {t('netDetected')}: {t('lang') === 'he' ? liveNet.nameHe : liveNet.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('netDetectedDesc')}</p>
            </div>
          </div>
        )}

        {catConnected && catTelemetry && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <RadioTower className="h-4 w-4" />
            {t('catAutoFilled')}
          </div>
        )}

        {catConnected && vfoMoving && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Activity className="h-4 w-4 animate-pulse" />
            {t('catVfoMoving')} ({settlingSeconds}s)
          </div>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{t('callsign')}</label>
            <div className={`${field} font-mono text-lg tracking-wider`}>{myCallsign}</div>
          </div>
          <div>
            <label className={label} htmlFor="gridsquare">{t('gridsquare')}</label>
            <input
              id="gridsquare"
              value={gridsquare}
              onChange={(e) => setGridsquare(e.target.value)}
              className={`${field} font-mono ${errors.gridsquare ? errClass : ''}`}
              autoComplete="off"
            />
            {errors.gridsquare && <p className="mt-1 text-xs font-semibold text-red-500">{t('fieldRequired')}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="band">{t('band')}</label>
              <select
                id="band"
                value={form.band}
                onChange={(e) => {
                  const band = e.target.value;
                  setForm((f) => ({ ...f, band, mode: defaultModeForBand(band) }));
                }}
                className={field}
              >
                {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="mode">{t('mode')}</label>
              <select id="mode" value={form.mode} onChange={(e) => set('mode', e.target.value)} className={field}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="freq">{t('frequency')}</label>
              <input
                id="freq"
                value={form.frequency}
                onChange={(e) => set('frequency', e.target.value)}
                inputMode="decimal"
                className={`${field} font-mono ${errors.frequency ? errClass : ''}`}
              />
              {errors.frequency && <p className="mt-1 text-xs font-semibold text-red-500">{t('freqOutOfRange')}</p>}
            </div>
            <div>
              <label className={label} htmlFor="power">{t('powerWatts')}</label>
              <input
                id="power"
                value={form.power}
                onChange={(e) => set('power', e.target.value)}
                inputMode="numeric"
                className={`${field} font-mono ${errors.power ? errClass : ''}`}
              />
              {errors.power && <p className="mt-1 text-xs font-semibold text-red-500">{t('powerOutOfRange')}</p>}
            </div>
          </div>

          <div>
            <label className={label} htmlFor="antenna">{t('antennaField')}</label>
            <select id="antenna" value={form.antenna} onChange={(e) => set('antenna', e.target.value)} className={field}>
              {ANTENNAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="city">{t('city')}</label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className={`${field} ${errors.city ? errClass : ''}`}
            />
            {errors.city && <p className="mt-1 text-xs font-semibold text-red-500">{t('fieldRequired')}</p>}
          </div>

          <div>
            <label className={label} htmlFor="comments">{t('comments')}</label>
            <textarea id="comments" value={form.comments} onChange={(e) => set('comments', e.target.value)} rows={3} className={`${field} resize-none`} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {submitting ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
