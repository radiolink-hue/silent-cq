import { useEffect, useRef, useState } from 'react';
import { Info, Radio, Loader2 } from 'lucide-react';
import { ANTENNAS } from '@/types';
import {
  DEFAULT_OPERATOR_ANTENNA,
  DEFAULT_OPERATOR_POWER,
  normalizeOperatorAntenna,
  parseOperatorPower,
} from '@/lib/operatorProfile';

const CALLSIGN_RE = /^(4[XYZ]|[WNKA]|[G]|[F]|[ZS]|[VK])/i;
const GRID_LOOKUP_URL = 'https://dxcluster.ha8tks.hu/hamgeocoding/';

interface LoginScreenProps {
  onLogin: (
    callsign: string,
    gridsquare: string,
    city: string,
    power: number,
    connectRadio: boolean,
    antenna: string
  ) => void;
  initialCallsign?: string;
  initialGridsquare?: string;
  initialCity?: string;
  initialPower?: number;
  initialAntenna?: string;
  cityOnly?: boolean;
}

export default function LoginScreen({
  onLogin,
  initialCallsign = '',
  initialGridsquare = '',
  initialCity = '',
  initialPower = DEFAULT_OPERATOR_POWER,
  initialAntenna = DEFAULT_OPERATOR_ANTENNA,
  cityOnly = false,
}: LoginScreenProps) {
  const [callsign, setCallsign] = useState(initialCallsign);
  const [gridsquare, setGridsquare] = useState(initialGridsquare);
  const [city, setCity] = useState(initialCity);
  const [power, setPower] = useState(String(initialPower || DEFAULT_OPERATOR_POWER));
  const [antenna, setAntenna] = useState(normalizeOperatorAntenna(initialAntenna) ?? DEFAULT_OPERATOR_ANTENNA);
  const [callsignError, setCallsignError] = useState('');
  const [gridError, setGridError] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [powerError, setPowerError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gridHelpHover, setGridHelpHover] = useState(false);
  const [gridHelpPinned, setGridHelpPinned] = useState(false);
  const gridHelpRef = useRef<HTMLDivElement>(null);
  const gridHelpOpen = gridHelpHover || gridHelpPinned;

  useEffect(() => {
    if (!gridHelpPinned) return;
    const close = (event: MouseEvent) => {
      if (!gridHelpRef.current?.contains(event.target as Node)) setGridHelpPinned(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [gridHelpPinned]);

  const finish = (connectRadio: boolean) => {
    const trimmed = callsign.trim();
    if (!cityOnly) {
      if (!trimmed) {
        setCallsignError('Callsign is required');
        return;
      }
      if (!CALLSIGN_RE.test(trimmed)) {
        setCallsignError('Not a valid Israeli Callsign');
        return;
      }
      setCallsignError('');
      if (!gridsquare.trim()) {
        setGridError(true);
        return;
      }
      setGridError(false);
    }
    if (!city.trim()) {
      setCityError(true);
      return;
    }
    setCityError(false);
    const parsedPower = parseOperatorPower(power);
    if (parsedPower == null) {
      setPowerError(true);
      return;
    }
    setPowerError(false);
    const parsedAntenna = normalizeOperatorAntenna(antenna) ?? DEFAULT_OPERATOR_ANTENNA;
    setSubmitting(true);
    onLogin(
      trimmed.toUpperCase(),
      gridsquare.trim().toUpperCase(),
      city.trim(),
      parsedPower,
      connectRadio,
      parsedAntenna
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    finish(false);
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div dir="ltr" lang="en" className="flex min-h-screen items-center justify-center px-4 text-left">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <Radio className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">SILENT CQ</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {cityOnly
              ? 'Your profile is missing a city. Enter your operating city'
              : 'Enter your Callsign, Grid Square, City, Power, and Antenna'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl glass p-6">
          {cityOnly ? (
            <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-white/5">
              <p className="font-mono text-lg font-bold tracking-wider">{callsign}</p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{gridsquare}</p>
            </div>
          ) : (
            <>
              <div>
                <label className={label} htmlFor="login-callsign">CALLSIGN</label>
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
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="login-grid">
                    GRIDSQUARE
                  </label>
                  <div
                    className="relative"
                    ref={gridHelpRef}
                    onMouseEnter={() => setGridHelpHover(true)}
                    onMouseLeave={() => setGridHelpHover(false)}
                  >
                    <button
                      type="button"
                      aria-label="Grid square help"
                      aria-expanded={gridHelpOpen}
                      onClick={() => setGridHelpPinned((open) => !open)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/20 dark:text-slate-300"
                    >
                      <Info className="h-3 w-3" aria-hidden />
                    </button>
                    {gridHelpOpen && (
                      <div
                        role="tooltip"
                        className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium normal-case leading-relaxed tracking-normal text-slate-700 shadow-xl dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <p>Don&apos;t know your Grid Square? Find it here:</p>
                        <a
                          href={GRID_LOOKUP_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all font-semibold text-brand-600 underline dark:text-brand-300"
                        >
                          {GRID_LOOKUP_URL}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  id="login-grid"
                  value={gridsquare}
                  onChange={(e) => setGridsquare(e.target.value)}
                  className={`${field} font-mono ${gridError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
                  autoComplete="off"
                />
                {gridError && <p className="mt-1 text-xs font-semibold text-red-500">Gridsquare is required</p>}
              </div>
            </>
          )}

          <div>
            <label className={label} htmlFor="login-city">CITY</label>
            <input
              id="login-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`${field} ${cityError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
              autoComplete="off"
              autoFocus={cityOnly}
            />
            {cityError && <p className="mt-1 text-xs font-semibold text-red-500">City is required</p>}
          </div>

          <div>
            <label className={label} htmlFor="login-power">POWER (WATTS)</label>
            <input
              id="login-power"
              value={power}
              onChange={(e) => setPower(e.target.value)}
              inputMode="numeric"
              className={`${field} font-mono ${powerError ? 'border-red-400 ring-2 ring-red-400/30' : ''}`}
              autoComplete="off"
            />
            {powerError && (
              <p className="mt-1 text-xs font-semibold text-red-500">Power must be an integer between 1 and 1500 watts</p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="login-antenna">ANTENNA</label>
            <select
              id="login-antenna"
              value={antenna}
              onChange={(e) => setAntenna(e.target.value)}
              className={field}
            >
              {ANTENNAS.map((choice) => (
                <option key={choice} value={choice}>{choice}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
            {cityOnly ? 'Save & Continue' : 'Connect'}
          </button>

          {/* Phase 2 - Omni-Rig implementation pending - hidden to prevent TX lockup risk */}
        </form>
      </div>
    </div>
  );
}
