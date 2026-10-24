import { Link } from 'react-router';

/** The Cove mark: a car's roofline sweeping along a curved studio wall that meets the floor. Original artwork. */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="8" fill="#1c2127" />
      <path
        d="M4 21c5-1.5 8-6 13-6.2 4-.1 7 1.8 11 5.2"
        fill="none"
        stroke="#efeae2"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M4 26h24" stroke="#4f7bff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Logo plus wordmark. The link goes home, as people expect. */
export function Logo() {
  return (
    <Link
      to="/"
      aria-label="Cove, home"
      className="inline-flex min-h-11 items-center gap-2 rounded-control text-ink"
    >
      <LogoMark />
      <span className="font-display text-2xl leading-none">Cove</span>
    </Link>
  );
}
