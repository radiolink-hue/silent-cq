import { useEffect, useState } from 'react';
import { X, Loader2, ExternalLink, Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function CallsignModal() {
  const { t, qrzCallsign, closeQrz } = useApp();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{
    callsign: string;
    name?: string;
    grid?: string;
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
    url?: string;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!qrzCallsign) {
      setProfile(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    setProfile(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/allmon2?callsign=${encodeURIComponent(qrzCallsign)}`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      signal: controller.signal,
    })
      .then(async (resp) => {
        clearTimeout(timeout);
        if (!resp.ok) throw new Error('lookup failed');
        const data = await resp.json();
        if (data.geocache) {
          setProfile({
            callsign: qrzCallsign,
            grid: data.geocache.gridsquare,
            city: data.geocache.city,
            country: data.geocache.country,
            lat: data.geocache.lat,
            lng: data.geocache.lng,
            url: `https://www.qrz.com/db/${encodeURIComponent(qrzCallsign)}`,
          });
        } else {
          setProfile({
            callsign: qrzCallsign,
            url: `https://www.qrz.com/db/${encodeURIComponent(qrzCallsign)}`,
          });
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        setError(true);
        setProfile({
          callsign: qrzCallsign,
          url: `https://www.qrz.com/db/${encodeURIComponent(qrzCallsign)}`,
        });
      })
      .finally(() => setLoading(false));

    return () => clearTimeout(timeout);
  }, [qrzCallsign]);

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

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-3">
            {profile.name && (
              <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{t('qrzName')}</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">{profile.name}</p>
              </div>
            )}
            {profile.grid && (
              <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{t('gridsquare')}</p>
                <p className="font-mono font-semibold text-slate-700 dark:text-slate-200">{profile.grid}</p>
              </div>
            )}
            {(profile.city || profile.country) && (
              <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{t('city')}</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
            {error && (
              <p className="text-xs font-semibold text-amber-500">{t('qrzLookupPartial')}</p>
            )}
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
        )}
      </div>
    </div>
  );
}
