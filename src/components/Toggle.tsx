interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  labelOff: string;
  labelOn: string;
  iconOff?: React.ReactNode;
  iconOn?: React.ReactNode;
  ariaLabel: string;
}

export default function Toggle({
  checked,
  onChange,
  labelOff,
  labelOn,
  iconOff,
  iconOn,
  ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className="group inline-flex items-center gap-2 rounded-full glass px-1.5 py-1 transition hover:border-brand-400/60"
    >
      <span
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
          !checked ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {iconOff}
        {labelOff}
      </span>
      <span
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
          checked ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {iconOn}
        {labelOn}
      </span>
    </button>
  );
}
