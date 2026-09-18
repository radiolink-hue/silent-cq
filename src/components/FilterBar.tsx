import { SlidersHorizontal, X } from 'lucide-react';
import { BANDS, MODES } from '@/types';
import { useApp } from '@/context/AppContext';

interface FilterBarProps {
  band: string;
  mode: string;
  onBand: (b: string) => void;
  onMode: (m: string) => void;
}

export default function FilterBar({ band, mode, onBand, onMode }: FilterBarProps) {
  const { t } = useApp();
  const active = band || mode;

  const base =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-200';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-3xl glass p-3">
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400">
        <SlidersHorizontal className="h-4 w-4" />
        {t('filters')}
      </span>
      <select value={band} onChange={(e) => onBand(e.target.value)} className={base} aria-label={t('band')}>
        <option value="">{t('allBands')}</option>
        {BANDS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <select value={mode} onChange={(e) => onMode(e.target.value)} className={base} aria-label={t('mode')}>
        <option value="">{t('allModes')}</option>
        {MODES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => {
            onBand('');
            onMode('');
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
