import { Radio, CheckCircle2, PhoneCall, X } from 'lucide-react';
import { CqEventKind } from '@/types';

export interface ToastItem {
  id: string;
  kind: CqEventKind;
  title: string;
  message: string;
}

const styles: Record<CqEventKind, { icon: typeof Radio; ring: string }> = {
  new_cq: { icon: Radio, ring: 'text-brand-500' },
  received_ok: { icon: CheckCircle2, ring: 'text-brand-500' },
  calling_you: { icon: PhoneCall, ring: 'text-sky-500' },
};

interface ToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[1000] flex flex-col items-center gap-2 px-3">
      {toasts.map((toast) => {
        const { icon: Icon, ring } = styles[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-2xl glass-strong p-3.5 shadow-2xl"
          >
            <div className={`mt-0.5 shrink-0 ${ring}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{toast.title}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
