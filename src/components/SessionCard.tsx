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

  return (
    <article className={`animate-fade-up glass transition hover:border-brand-400/50 hover:shadow-xl hover:shadow-brand-500/5 ${compact ? 'rounded-2xl p-2' : 'rounded-3xl p-4'}`}>
      <div className={`flex flex-wrap items-start ${compact ? 'gap-1.5' : 'gap-3'}`}>
        <div className={`flex shrink-0 items-center justify-center bg-brand-500/15 text-brand-600 dark:text-brand-300 ${compact ? 'h-7 w-7 rounded-xl' : 'h-12 w-12 rounded-2xl'}`}>
          <Radio className={compact ? 'h-3.5 w-3.5' : 'h-6 w-6'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
            <h3 className={`font-bold tracking-wide ${compact ? 'text-sm' : 'text-xl'}`}><CallsignLink callsign={session.callsign} /></h3>
            <span className={`inline-flex items-center gap-1 rounded-full bg-brand-500/15 font-bold text-brand-600 dark:text-brand-300 ${compact ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>
              <span className={`animate-pulse rounded-full bg-brand-500 ${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'}`} />
              {t('liveNow')}
            </span>
            {session.is_proxy && (
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', marginLeft: '6px' }} />
            )}
          </div>
          {location && (
            <p className={`flex items-center gap-1 text-slate-500 dark:text-slate-400 ${compact ? 'mt-0 text-[11px]' : 'mt-0.5 text-sm'}`}>
              <MapPin className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
              {location}
            </p>
          )}
        </div>
        <div className="text-end">
          <div className={`flex items-center justify-end ${compact ? 'gap-1' : 'gap-2'}`}>
            <div className={`inline-flex items-center gap-1 rounded-full bg-slate-100 font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}>
              <Users className={`text-brand-500 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
              {t('heardCount')}: <span className="font-bold text-brand-600 dark:text-brand-300">{session.heard_count}</span>
            </div>
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(session)}
                aria-label={t('delete')}
                title={t('delete')}
                className={`inline-flex items-center justify-center rounded-full bg-red-500/10 text-red-500 transition hover:bg-red-500/20 active:scale-95 ${compact ? 'p-1' : 'p-1.5'}`}
              >
                <Trash2 className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
              </button>
            )}
          </div>
          <p className={`flex items-center justify-end gap-1 text-slate-400 ${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'}`}>
            <Clock className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {timeAgo(session.created_at, t)}
          </p>
        </div>
      </div>

      <div className={`flex flex-wrap ${compact ? 'mt-1.5 gap-1' : 'mt-3 gap-2'}`}>
        {session.band && <Chip compact={compact}>{session.band}</Chip>}
        {session.mode && <Chip compact={compact}>{session.mode}</Chip>}
        {session.frequency && <Chip compact={compact}>{session.frequency} MHz</Chip>}
        {session.gridsquare && <Chip compact={compact}>{t('grid')}: {session.gridsquare}</Chip>}
        {distance != null && <Chip compact={compact} highlight>{distance} km</Chip>}
      </div>

      {(session.power || session.antenna) && (
        <div className={`grid grid-cols-2 text-sm sm:grid-cols-3 ${compact ? 'mt-1.5 gap-1' : 'mt-3 gap-2'}`}>
          {session.power && <Meta compact={compact} icon={<Zap className={compact ? 'h-3 w-3' : 'h-4 w-4'} />} label={t('power')} value={session.power} />}
          {session.antenna && <Meta compact={compact} icon={<AntennaIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />} label={t('antenna')} value={session.antenna} />}
        </div>
      )}

      {session.comments && (
        <p className={`text-slate-600 dark:bg-white/5 dark:text-slate-300 ${compact ? 'mt-1.5 truncate rounded-xl bg-slate-50 px-2 py-0.5 text-[11px]' : 'mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm'}`}>
          {session.comments}
        </p>
      )}

      {reports.length > 0 && (
        <div className={compact ? 'mt-1.5 space-y-0.5' : 'mt-3 space-y-1.5'}>
          <p className={`font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{t('reporters')}:</p>
          {reports.map((r) => (
            <div key={r.id} className={`flex items-center justify-between gap-2 bg-slate-50 text-xs dark:bg-white/5 ${compact ? 'rounded-lg px-2 py-0.5' : 'rounded-xl px-2.5 py-1.5'}`}>
              <div className="flex items-center gap-2">
                <CallsignLink callsign={r.reporter_callsign} className="text-xs" />
                <span className={`rounded-full bg-brand-500/15 font-mono font-bold text-brand-600 dark:text-brand-300 ${compact ? 'px-1.5 py-0' : 'px-2 py-0.5'}`}>
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

      {session.callsign.toUpperCase() !== myCallsign.toUpperCase() && (
        <div className={`flex gap-2 ${compact ? 'mt-2' : 'mt-4'}`}>
          {hasReported ? (
            <div className={`flex flex-1 items-center justify-center gap-2 bg-slate-100 font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400 ${compact ? 'rounded-xl px-2 py-1 text-[11px]' : 'rounded-2xl px-4 py-2.5 text-sm'}`}>
              {t('alreadyReported')}
            </div>
          ) : !canReport ? (
            <div className={`flex flex-1 items-center justify-center gap-2 bg-amber-500/10 font-bold text-amber-600 dark:text-amber-400 ${compact ? 'rounded-xl px-2 py-1 text-[11px]' : 'rounded-2xl px-4 py-2.5 text-sm'}`}>
              {t('reportGateBlocked')}
            </div>
          ) : (
            <>
              <select
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
                className={`flex-1 border border-slate-200 bg-white font-bold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 ${compact ? 'rounded-xl px-2 py-1 text-[11px]' : 'rounded-2xl px-3 py-2.5 text-sm'}`}
              >
                <option value="">{t('signalReport')}</option>
                {SIGNAL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedSignal}
                className={`inline-flex items-center justify-center gap-2 bg-brand-500 font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50 ${compact ? 'rounded-xl px-3 py-1 text-[11px]' : 'rounded-2xl px-5 py-2.5 text-sm'}`}
              >
                {t('submitReport')}
              </button>
            </>
          )}
        </div>
      )}
      {session.callsign.toUpperCase() === myCallsign.toUpperCase() && (
        <div className={`flex items-center justify-center bg-slate-100 font-bold text-slate-400 dark:bg-white/5 dark:text-slate-500 ${compact ? 'mt-2 rounded-xl px-2 py-1 text-[11px]' : 'mt-4 rounded-2xl px-4 py-2.5 text-sm'}`}>
          {t('selfReportBlocked')}
        </div>
      )}
    </article>
  );
}

function Chip({ children, highlight, compact }: { children: React.ReactNode; highlight?: boolean; compact?: boolean }) {
  return (
    <span
      className={`rounded-full font-mono font-semibold ${
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${
        highlight
          ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
          : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200'
      }`}
    >
      {children}
    </span>
  );
}

function Meta({ icon, label, value, compact }: { icon: React.ReactNode; label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex items-center bg-slate-50 dark:bg-white/5 ${compact ? 'gap-1 rounded-xl px-2 py-1' : 'gap-2 rounded-2xl px-3 py-2'}`}>
      <span className="text-brand-500">{icon}</span>
      <div className="min-w-0">
        <p className={`uppercase tracking-wide text-slate-400 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>{label}</p>
        <p className={`truncate font-semibold text-slate-700 dark:text-slate-200 ${compact ? 'text-xs' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
