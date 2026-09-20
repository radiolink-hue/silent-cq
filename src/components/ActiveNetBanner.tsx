import { useApp } from '@/context/AppContext';
import type { LiveNetSchedule } from '@/lib/liveNetSchedule';

interface ActiveNetBannerProps {
  net: LiveNetSchedule | null;
}

export default function ActiveNetBanner({ net }: ActiveNetBannerProps) {
  const { t } = useApp();

  if (!net) {
    return (
      <div className="bg-slate-400 px-3 py-2 text-center text-sm font-bold text-slate-800 dark:bg-slate-600 dark:text-slate-100">
        {t('noActiveNet')}
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 text-center text-sm font-bold ${net.bannerClass}`}>
      <span className="inline-block">{net.name}</span>
      <span className="mx-2 opacity-70" aria-hidden>
        ·
      </span>
      <span className="inline-block" dir="rtl">
        {net.nameHe}
      </span>
    </div>
  );
}
