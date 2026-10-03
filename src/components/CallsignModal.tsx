import { X, ExternalLink, Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function CallsignModal() {
  const { t, qrzCallsign, closeQrz } = useApp();

  if (!qrzCallsign) return null;

  const qrzUrl = `https://www.qrz.com/db/${encodeURIComponent(qrzCallsign)}`;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={closeQrz}
    >
      <div
        className="w-full max-w-sm animate-fade-up rounded-3xl glass-strong p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="font-mono text-lg font-bold tracking-wide">{qrzCallsign}</h3>
          </div>
          <button
            type="button"
            onClick={closeQrz}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <a
          href={qrzUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98]"
        >
          <ExternalLink className="h-4 w-4" />
          {t('qrzViewFull')}
        </a>
      </div>
    </div>
  );
}
