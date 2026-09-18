import { useState } from 'react';
import { RadioTower, Loader2, AlertTriangle } from 'lucide-react';
import { CqSession, CqSignalReport } from '@/types';
import { useApp } from '@/context/AppContext';
import SessionCard from '@/components/SessionCard';
import FilterBar from '@/components/FilterBar';

interface ActiveUsersProps {
  sessions: CqSession[];
  loading: boolean;
  error: boolean;
  myPos: { lat: number; lng: number } | null;
  myCallsign: string;
  isAdmin?: boolean;
  hasActiveCQ: boolean;
  getReportsForSession: (sessionId: string) => CqSignalReport[];
  hasReported: (sessionId: string, callsign: string) => boolean;
  onSubmitReport: (session: CqSession, signal: string) => void;
  onDeleteReport: (reportId: string, sessionId: string) => void;
  onDelete?: (session: CqSession) => void;
}

export default function ActiveUsers({
  sessions,
  loading,
  error,
  myPos,
  myCallsign,
  isAdmin,
  hasActiveCQ,
  getReportsForSession,
  hasReported,
  onSubmitReport,
  onDeleteReport,
  onDelete,
}: ActiveUsersProps) {
  const { t } = useApp();
  const [band, setBand] = useState('');
  const [mode, setMode] = useState('');

  const filtered = sessions.filter(
    (s) => (!band || s.band === band) && (!mode || s.mode === mode)
  );

  return (
    <div className="space-y-4">
      <FilterBar band={band} mode={mode} onBand={setBand} onMode={setMode} />

      {loading && (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-3xl glass py-16 text-center text-slate-500">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="font-semibold">{t('loadError')}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl glass px-6 py-16 text-center text-slate-500 dark:text-slate-400">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500/10 text-brand-500">
            <RadioTower className="h-8 w-8" />
          </div>
          <p className="max-w-xs font-medium">{t('noSessions')}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              myPos={myPos}
              myCallsign={myCallsign}
              hasReported={hasReported(s.id, myCallsign)}
              reports={getReportsForSession(s.id)}
              onSubmitReport={onSubmitReport}
              onDeleteReport={onDeleteReport}
              onDelete={onDelete}
              canDelete={isAdmin || s.callsign.toUpperCase() === myCallsign.toUpperCase()}
              canReport={hasActiveCQ}
            />
          ))}
        </div>
      )}
    </div>
  );
}
