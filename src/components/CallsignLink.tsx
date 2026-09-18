interface CallsignLinkProps {
  callsign: string;
  className?: string;
}

export default function CallsignLink({ callsign, className = '' }: CallsignLinkProps) {
  const url = `https://www.qrz.com/db/${encodeURIComponent(callsign.toUpperCase())}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-mono font-bold text-brand-600 underline-offset-2 transition hover:text-brand-700 hover:underline dark:text-brand-300 dark:hover:text-brand-200 ${className}`}
    >
      {callsign}
    </a>
  );
}
