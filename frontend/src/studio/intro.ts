/** The clay-to-render intro on the landing hero: a grey clay car with wireframe, then a light sweeps over it and reveals the paint. */
export const INTRO = { holdMs: 1100, sweepMs: 1700 } as const;

export type IntroState = { phase: 'hold' | 'sweep' | 'done'; sweep: number; done: boolean };

// Smootherstep: zero slope at both ends, so the light eases in and out.
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Where the intro is, `elapsedMs` after the first frame was drawn. `sweep` runs 0 to 1 across the car. */
export function introState(elapsedMs: number): IntroState {
  if (elapsedMs < INTRO.holdMs) return { phase: 'hold', sweep: 0, done: false };
  const t = (elapsedMs - INTRO.holdMs) / INTRO.sweepMs;
  if (t >= 1) return { phase: 'done', sweep: 1, done: true };
  return { phase: 'sweep', sweep: ease(t), done: false };
}

const SWEEP_MARGIN = 0.3;

/** x position of the sweep line for a car of this length: starts behind the tail, ends past the nose. */
export function sweepX(sweep: number, length: number): number {
  const start = -length / 2 - SWEEP_MARGIN;
  const end = length / 2 + SWEEP_MARGIN;
  return start + (end - start) * sweep;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const KEY = 'cove:intro-played';
// Used only when sessionStorage is blocked: at least once per page load, not on every mount.
let playedThisLoad = false;

/**
 * True the first time it is asked in a browser session, never under reduced motion. Asking marks the intro as
 * played, so call it only when the intro is about to start.
 */
export function shouldPlayIntro({
  reducedMotion,
  storage = typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
}: {
  reducedMotion: boolean;
  storage?: Storage;
}): boolean {
  if (reducedMotion) return false;
  try {
    if (!storage) throw new Error('no storage');
    if (storage.getItem(KEY)) return false;
    storage.setItem(KEY, '1');
    return true;
  } catch {
    if (playedThisLoad) return false;
    playedThisLoad = true;
    return true;
  }
}
