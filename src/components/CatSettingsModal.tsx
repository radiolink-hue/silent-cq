import { useEffect, useState } from 'react';
import { Settings, X, Usb, Wifi, Loader2, CheckCircle2, XCircle, AlertTriangle, Info, XOctagon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useCatControl, RadioProtocol, RADIO_MODELS, getRadioModel } from '@/hooks/useCatControl';

interface CatSettingsModalProps {
  open: boolean;
  onClose: () => void;
  cat: ReturnType<typeof useCatControl>;
}

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200];

export default function CatSettingsModal({ open, onClose, cat }: CatSettingsModalProps) {
  const { t } = useApp();
  const [connecting, setConnecting] = useState(false);
  const [localRadioModel, setLocalRadioModel] = useState(cat.settings.radioModel);
  const [localBaudRate, setLocalBaudRate] = useState(cat.settings.baudRate);
  const [localStopBits, setLocalStopBits] = useState<1 | 2>(cat.settings.stopBits);
  const [localCivAddress, setLocalCivAddress] = useState(cat.settings.civAddress);
  const [localWsUrl, setLocalWsUrl] = useState(cat.settings.wsUrl);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);

  useEffect(() => {
    if (cat.connected && autoCloseCountdown > 0) {
      const timer = setTimeout(() => setAutoCloseCountdown((n) => n - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (cat.connected && autoCloseCountdown === 0) {
      onClose();
    }
  }, [cat.connected, autoCloseCountdown, onClose]);

  if (!open) return null;

  const radio = getRadioModel(localRadioModel);
  const isIcom = radio.protocol === 'icom';
  const isProxy = radio.protocol === 'websocket';

  const handleRadioModelChange = (modelId: string) => {
    const model = getRadioModel(modelId);
    setLocalRadioModel(modelId);
    setLocalBaudRate(model.defaultBaud);
    setLocalStopBits(model.defaultStopBits);
    setLocalCivAddress(model.civAddress);
    if (model.defaultWsUrl) setLocalWsUrl(model.defaultWsUrl);
  };

  const handleConnect = async () => {
    cat.updateSettings({
      radioModel: localRadioModel,
      protocol: radio.protocol,
      baudRate: localBaudRate,
      stopBits: localStopBits,
      civAddress: localCivAddress,
      wsUrl: localWsUrl,
    });
    setConnecting(true);
    const success = await cat.connect();
    setConnecting(false);
    if (success) {
      setAutoCloseCountdown(3);
    }
  };

  const handleDisconnect = () => {
    cat.disconnect();
    setAutoCloseCountdown(0);
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg animate-slide-in overflow-y-auto rounded-3xl glass-strong p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
              <Settings className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">{t('catSettings')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-slate-200 p-2 text-slate-600 transition hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Connection Status */}
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
          {cat.connected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {t('catConnected')}: {radio.label}
              </span>
              {autoCloseCountdown > 0 && (
                <span className="ms-auto text-xs font-semibold text-emerald-500">
                  {t('catAutoClose')} {autoCloseCountdown}s
                </span>
              )}
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {t('catDisconnected')}
              </span>
            </>
          )}
        </div>

        {/* Browser Support Warning */}
        {!cat.webSerialSupported && !isProxy && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-amber-500/10 px-3.5 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('catUnsupported')}
            </p>
          </div>
        )}

        {/* Error */}
        {cat.error && (
          <div className="mb-4 rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
            {cat.error}
          </div>
        )}

        {/* COM Port Sharing Notice */}
        {!isProxy && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-blue-500/10 px-3.5 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {t('catComSharingNotice')}
            </p>
          </div>
        )}

        {/* Radio Model Selector */}
        <div className="mb-4">
          <label className={label}>{t('catRadioModel')}</label>
          <select
            value={localRadioModel}
            onChange={(e) => handleRadioModelChange(e.target.value)}
            className={field}
            disabled={cat.connected}
          >
            {RADIO_MODELS.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </div>

        {/* Baud Rate (serial only) */}
        {!isProxy && (
          <div className="mb-4">
            <label className={label}>{t('catBaudRate')}</label>
            <select
              value={localBaudRate}
              onChange={(e) => setLocalBaudRate(parseInt(e.target.value, 10))}
              className={field}
              disabled={cat.connected}
            >
              {BAUD_RATES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stop Bits (serial only) */}
        {!isProxy && (
          <div className="mb-4">
            <label className={label}>{t('catStopBits')}</label>
            <select
              value={localStopBits}
              onChange={(e) => setLocalStopBits(parseInt(e.target.value, 10) as 1 | 2)}
              className={field}
              disabled={cat.connected}
            >
              <option value={1}>{t('catStopBits1')}</option>
              <option value={2}>{t('catStopBits2')}</option>
            </select>
          </div>
        )}

        {/* CI-V Address (Icom only) */}
        {isIcom && (
          <div className="mb-4">
            <label className={label}>{t('catCivAddress')}</label>
            <input
              value={localCivAddress}
              onChange={(e) => setLocalCivAddress(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 2))}
              className={`${field} font-mono`}
              placeholder="94"
              maxLength={2}
              disabled={cat.connected}
            />
          </div>
        )}

        {/* Proxy Server URL (websocket only) */}
        {isProxy && (
          <div className="mb-4">
            <label className={label}>{t('catProxyUrl')}</label>
            <input
              value={localWsUrl}
              onChange={(e) => setLocalWsUrl(e.target.value)}
              className={`${field} font-mono`}
              placeholder="ws://127.0.0.1:12345"
              disabled={cat.connected}
            />
          </div>
        )}

        {/* Connect/Disconnect Buttons */}
        <div className="mb-4">
          {cat.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600 active:scale-[0.99]"
            >
              <X className="h-5 w-5" />
              {t('catDisconnect')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-70"
            >
              {connecting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isProxy ? (
                <Wifi className="h-5 w-5" />
              ) : (
                <Usb className="h-5 w-5" />
              )}
              {connecting ? t('submitting') : t('catConnect')}
            </button>
          )}
        </div>

        {/* Telemetry Display */}
        {cat.connected && cat.telemetry && (
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('catTelemetry')}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-400">{t('catFreq')}</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {cat.telemetry.frequency || '—'} MHz
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400">{t('catMode')}</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {cat.telemetry.mode || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400">{t('catBand')}</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {cat.telemetry.band || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400">{t('catPower')}</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {cat.telemetry.power || '—'} W
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {cat.vfoMoving ? (
                <>
                  <XOctagon className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {t('catVfoWait')} ({cat.settlingSeconds}s)
                  </span>
                </>
              ) : cat.settledTelemetry ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {t('catSettled')}
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {t('catSettling')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
