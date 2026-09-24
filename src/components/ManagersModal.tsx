import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Trash2, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { ADMIN_CALLSIGN } from '@/lib/adminProxy';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ManagerRow {
  id: string;
  callsign: string;
  added_by: string;
  added_at: string;
}

interface ManagersModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const MAX_MANAGERS = 10;

export default function ManagersModal({ open, onClose, isAdmin }: ManagersModalProps) {
  const { t } = useApp();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<ManagerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('managers')
      .select('id, callsign, added_by, added_at')
      .order('added_at', { ascending: true })
      .limit(MAX_MANAGERS);
    if (!err) setManagers((data ?? []) as ManagerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCallsign('');
    setError('');
    setPendingRemove(null);
    void load();
  }, [open, load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cs = callsign.trim().toUpperCase();
    if (!cs) {
      setError(t('callsignRequired'));
      return;
    }
    if (cs === ADMIN_CALLSIGN) {
      setError(t('managerCannotAddAdmin'));
      return;
    }
    if (managers.some((m) => m.callsign.toUpperCase() === cs)) {
      setError(t('managerAlreadyExists'));
      return;
    }
    if (managers.length >= MAX_MANAGERS) {
      setError(t('managerLimit'));
      return;
    }
    setAdding(true);
    setError('');
    const { error: err } = await supabase.from('managers').insert({
      callsign: cs,
      added_by: ADMIN_CALLSIGN,
    });
    setAdding(false);
    if (err) {
      if (err.code === '23505') setError(t('managerAlreadyExists'));
      else setError(t('reportError'));
      return;
    }
    setCallsign('');
    void load();
  };

  const confirmRemove = async () => {
    const row = pendingRemove;
    setPendingRemove(null);
    if (!row) return;
    await supabase.from('managers').delete().eq('id', row.id);
    void load();
  };

  if (!open) return null;

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

  return (
    <>
      <div
        className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md animate-fade-up rounded-3xl glass-strong p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold">{t('managersTitle')}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15"
              aria-label={t('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isAdmin && (
            <form onSubmit={handleAdd} className="mb-4 flex gap-2">
              <input
                value={callsign}
                onChange={(e) => {
                  setCallsign(e.target.value.toUpperCase());
                  setError('');
                }}
                className={field}
                placeholder={t('managerCallsignPlaceholder')}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={adding}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-600 disabled:opacity-70"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('managerAdd')}
              </button>
            </form>
          )}

          {error && <p className="mb-3 text-sm font-semibold text-red-500">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
            </div>
          ) : managers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{t('managerEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {managers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5"
                >
                  <span className="flex items-center gap-2 font-mono font-bold">
                    <Shield className="h-4 w-4 text-teal-500" />
                    {m.callsign}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(m)}
                      className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingRemove}
        title={t('managerRemoveTitle')}
        message={t('managerRemoveMsg').replace('[callsign]', pendingRemove?.callsign ?? '')}
        confirmLabel={t('confirmDelete')}
        cancelLabel={t('cancel')}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}
