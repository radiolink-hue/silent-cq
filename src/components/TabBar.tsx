import { Users, Map, Radio, Network } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export type Tab = 'active' | 'map' | 'call' | 'nets';

interface TabBarProps {
  active: Tab;
  onChange: (t: Tab) => void;
  activeCount: number;
  isAdmin?: boolean;
}

export default function TabBar({ active, onChange, activeCount, isAdmin }: TabBarProps) {
  const { t } = useApp();
  const tabs: { key: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { key: 'active', label: t('tabActive'), icon: Users, badge: activeCount },
    { key: 'map', label: t('tabMap'), icon: Map },
    { key: 'call', label: t('tabCall'), icon: Radio },
    ...(isAdmin ? [{ key: 'nets' as Tab, label: t('tabNets'), icon: Network }] : []),
  ];

  return (
    <>
      <div className="netlify-spacer" aria-hidden="true" />
      <nav className="mobile-tab-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 pb-nav-safe backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 sm:static sm:bottom-auto sm:mx-auto sm:mt-6 sm:max-w-md sm:rounded-full sm:border sm:bg-transparent sm:p-1.5 sm:dark:bg-transparent sm:glass">
      <div className="mx-auto flex max-w-6xl items-center justify-around gap-1 px-2 pt-1.5 sm:justify-between sm:p-0">
        {tabs.map(({ key, label, icon: Icon, badge }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-xs font-bold transition sm:flex-row sm:gap-2 sm:rounded-full sm:py-2.5 sm:text-sm ${
                isActive
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                  : 'text-slate-500 hover:text-brand-600 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {badge ? (
                <span
                  className={`ms-0.5 rounded-full px-1.5 text-[10px] font-extrabold leading-4 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
