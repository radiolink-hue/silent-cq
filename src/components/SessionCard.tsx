import { useState } from 'react';
import { Radio, MapPin, Zap, Antenna as AntennaIcon, Clock, Trash2, Users } from 'lucide-react';
import { CqSession, CqSignalReport, SIGNAL_OPTIONS } from '@/types';
import { useApp } from '@/context/AppContext';
import { haversineKm } from '@/lib/maidenhead';
import { timeAgo } from '@/lib/time';
import CallsignLink from '@/components/CallsignLink';

interface SessionCardProps {
  session: CqSession;
  myPos: { lat: number; lng: number } | null;
  myCallsign: string;
  hasReported: boolean;
  reports: CqSignalReport[];
  onSubmitReport: (session: CqSession, signal: string) => void;
  onDeleteReport: (reportId: string, sessionId: string) => void;
  onDelete?: (session: CqSession) => void;
  canDelete?: boolean;
  canReport?: boolean;
  compact?: boolean;
}

export default function SessionCard({
  session,
  myPos,
  myCallsign,
  hasReported,
  reports,
  onSubmitReport,
  onDeleteReport,
  onDelete,
  canDelete,
  canReport = true,
  compact,
}: SessionCardProps) {
  const { t } = useApp();
  const [selectedSignal, setSelectedSignal] = useState('');

  const distance =
    myPos && session.lat != null && session.lng != null
      ? haversineKm(myPos.lat, myPos.lng, session.lat, session.lng)
      : null;

  const location = [session.city].filter(Boolean).join(', ');

  const handleSubmit = () => {
    if (!selectedSignal) return;
    onSubmitReport(session, selectedSignal);
    setSelectedSignal('');
  };

  const myReport = reports.find(
    (r) => r.reporter_callsign.toUpperCase() === myCallsign.toUpperCase()
  );

  return (
    <article className="animate-fade-up rounded-3xl glass p-4 transition hover:border-brand-400/50 hover:shadow-xl hover:shadow-brand-500/5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
          <Radio className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-wide"><CallsignLink callsign={session.callsign} /></h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              {t('liveNow')}
            </span>
          </div>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
        </div>
        <div className="text-end">
          <div className="flex items-center justify-end gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">
              <Users className="h-3.5 w-3.5 text-brand-500" />
              {t('heardCount')}: <span className="font-bold text-brand-600 dark:text-brand-300">{session.heard_count}</span>
            </div>
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(session)}
                aria-label={t('delete')}
                title={t('delete')}
                className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            {timeAgo(session.created_at, t)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {session.band && <Chip>{session.band}</Chip>}
        {session.mode && <Chip>{session.mode}</Chip>}
        {session.frequency && <Chip>{session.frequency} MHz</Chip>}
        {session.gridsquare && <Chip>{t('grid')}: {session.gridsquare}</Chip>}
        {distance != null && <Chip highlight>{distance} km</Chip>}
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {session.power && <Meta icon={<Zap className="h-4 w-4" />} label={t('power')} value={session.power} />}
          {session.antenna && <Meta icon={<AntennaIcon className="h-4 w-4" />} label={t('antenna')} value={session.antenna} />}
        </div>
      )}

      {session.comments && !compact && (
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {session.comments}
        </p>
      )}

      {/* Reporters list */}
      {reports.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('reporters')}:</p>
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-white/5">
              <div className="flex items-center gap-2">
                <CallsignLink callsign={r.reporter_callsign} className="text-xs" />
                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-mono font-bold text-brand-600 dark:text-brand-300">
                  {r.signal_report}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{timeAgo(r.created_at, t)}</span>
                {r.reporter_callsign.toUpperCase() === myCallsign.toUpperCase() && (
                  <button
                    type="button"
                    onClick={() => onDeleteReport(r.id, session.id)}
                    className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                    aria-label={t('delete')}
                    title={t('delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signal report selector — hidden for own CQ entry */}
      {!compact && session.callsign.toUpperCase() !== myCallsign.toUpperCase() && (
        <div className="mt-4 flex gap-2">
          {hasReported ? (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
              {t('alreadyReported')}
            </div>
          ) : !canReport ? (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-600 dark:text-amber-400">
              {t('reportGateBlocked')}
            </div>
          ) : (
            <>
              <select
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              >
                <option value="">{t('signalReport')}</option>
                {SIGNAL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedSignal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
              >
                {t('submitReport')}
              </button>
            </>
          )}
        </div>
      )}
      {!compact && session.callsign.toUpperCase() === myCallsign.toUpperCase() && (
        <div className="mt-4 flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-400 dark:bg-white/5 dark:text-slate-500">
          {t('selfReportBlocked')}
        </div>
      )}
    </article>
  );
}

function Chip({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
        highlight
          ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
          : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200'
      }`}
    >
      {children}
    </span>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5">
      <span className="text-brand-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}
