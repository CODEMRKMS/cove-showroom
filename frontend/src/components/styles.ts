// Shared class strings for controls, so every button and field gets the same focus, size and states.
// Touch targets are at least 44px tall (min-h-11).
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 font-semibold transition-colors duration-150 disabled:cursor-not-allowed';

export const btnPrimary = `${base} bg-accent text-accent-ink hover:brightness-110 active:translate-y-px disabled:bg-floor disabled:text-graphite disabled:ring-1 disabled:ring-line disabled:brightness-100`;
export const btnQuiet = `${base} bg-transparent text-ink ring-1 ring-graphite hover:bg-floor active:translate-y-px disabled:text-graphite disabled:opacity-70`;
export const btnDanger = `${base} bg-sold text-white hover:brightness-110 active:translate-y-px disabled:opacity-60`;

export const field =
  'min-h-11 w-full rounded-control border border-graphite bg-white/70 px-3 text-ink placeholder:text-graphite aria-[invalid=true]:border-sold aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-sold';
export const label = 'mb-1 block text-sm font-semibold text-ink';
