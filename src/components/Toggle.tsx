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
      className="group inline-flex shrink-0 items-center gap-0.5 rounded-full glass px-1 py-0.5 transition hover:border-brand-400/60 sm:gap-2 sm:px-1.5 sm:py-1"
    >
      <span
        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition sm:px-2.5 sm:py-1 sm:text-xs ${
          !checked ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {iconOff}
        {labelOff}
      </span>
      <span
        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition sm:px-2.5 sm:py-1 sm:text-xs ${
          checked ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {iconOn}
        {labelOn}
      </span>
    </button>
  );
}
