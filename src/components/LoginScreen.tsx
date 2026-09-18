import { useState } from 'react';
import { Radio, Loader2, Usb } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const CALLSIGN_RE = /^(4[XYZ]|[WNKA]|[G]|[F]|[ZS]|[VK])/i;

interface LoginScreenProps {
  onLogin: (callsign: string, gridsquare: string, city: string, connectRadio: boolean) => void;
  initialCity?: string;
}

export default function LoginScreen({ onLogin, initialCity }: LoginScreenProps) {
  const { t } = useApp();
  const [callsign, setCallsign] = useState(() => localStorage.getItem('scq_callsign') || '');
  const [gridsquare, setGridsquare] = useState(() => localStorage.getItem('scq_gridsquare') || '');
  const [city, setCity] = useState(initialCity || localStorage.getItem('scq_city') || '');
  const [callsignError, setCallsignError] = useState('');
  const [gridError, setGridError] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = callsign.trim();
    if (!trimmed) {
      setCallsignError(t('callsignRequired'));
      return;
    }
    if (!CALLSIGN_RE.test(trimmed)) {
      setCallsignError(t('invalidCallsign'));
      return;
    }
    setCallsignError('');
    if (!gridsquare.trim()) {
      setGridError(true);
      return;
    }
    setGridError(false);
    if (!city.trim()) {
      setCityError(true);
      return;
    }
    setCityError(false);
    setSubmitting(true);
    onLogin(trimmed.toUpperCase(), gridsquare.trim().toUpperCase(), city.trim(), false);
  };

  const handleConnectRadio = () => {
    const trimmed = callsign.trim();
    if (!trimmed) {
      setCallsignError(t('callsignRequired'));
      return;
    }
    if (!CALLSIGN_RE.test(trimmed)) {
      setCallsignError(t('invalidCallsign'));
      return;
    }
    setCallsignError('');
    if (!gridsquare.trim()) {
      setGridError(true);
      return;
    }
    setGridError(false);
    if (!city.trim()) {
      setCityError(true);
      return;
    }
    setCityError(false);
    setSubmitting(true);
    onLogin(trimmed.toUpperCase(), gridsquare.trim().toUpperCase(), city.trim(), true);
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <Radio className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">{t('appTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl glass p-6">
          <div>
            <label className={label} htmlFor="login-callsign">{t('callsign')}</label>
            <input
              id="login-callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              className={`${field} font-mono text-lg tracking-wider ${callsignError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
              autoComplete="off"
            />
            {callsignError && <p className="mt-1 text-xs font-semibold text-red-500">{callsignError}</p>}
          </div>

          <div>
            <label className={label} htmlFor="login-grid">{t('gridsquare')}</label>
            <input
              id="login-grid"
              value={gridsquare}
              onChange={(e) => setGridsquare(e.target.value)}
              className={`${field} font-mono ${gridError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
              autoComplete="off"
            />
            {gridError && <p className="mt-1 text-xs font-semibold text-red-500">{t('gridRequired')}</p>}
          </div>

          <div>
            <label className={label} htmlFor="login-city">{t('city')}</label>
            <input
              id="login-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`${field} ${cityError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
              autoComplete="off"
            />
            {cityError && <p className="mt-1 text-xs font-semibold text-red-500">{t('cityRequired')}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
            {t('loginButton')}
          </button>

          <div className="pt-2">
            <p className="mb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('connectRadioPrompt')}
            </p>
            <button
              type="button"
              onClick={handleConnectRadio}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-70"
            >
              <Usb className="h-4 w-4" />
              {t('connectRadioYes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
