import { Bug } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { CqSession } from '@/types';

interface ReportButtonProps {
  sessions: CqSession[];
  activeTab: string;
}

export default function ReportButton({ sessions, activeTab }: ReportButtonProps) {
  const { t, lang, theme } = useApp();

  const buildMailto = () => {
    const subject =
      lang === 'he'
        ? '[התשמע קולי] דיווח תקלה / בקשת תכונה'
        : '[HATISHMA KOLI] Bug Report / Feature Request';

    const context = [
      '----------------------------------------',
      lang === 'he' ? 'מידע טכני (אנא אל תמחקו):' : 'Technical context (please keep):',
      `Language: ${lang}`,
      `Theme: ${theme}`,
      `Active tab: ${activeTab}`,
      `Active sessions: ${sessions.length}`,
      `Platform: ${navigator.platform} / ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      '----------------------------------------',
      '',
      lang === 'he' ? 'תיאור הבעיה / הבקשה:' : 'Describe your issue / request:',
      '',
    ].join('\n');

    return `mailto:4x1da.2013@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(context)}`;
  };

  return (
    <a
      href={buildMailto()}
      className="fixed bottom-24 z-40 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-amber-500/30 transition hover:bg-amber-600 active:scale-95 sm:bottom-6 ltr:right-4 rtl:left-4 sm:ltr:right-6 sm:rtl:left-6"
      title={t('reportBug')}
    >
      <Bug className="h-5 w-5" />
      <span className="hidden sm:inline">{t('reportBug')}</span>
    </a>
  );
}
