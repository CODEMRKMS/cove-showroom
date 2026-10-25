/** The purchase moment: after a successful buy the camera eases back, a soft light sweeps the car, then all settles. */
export const MOMENT = { totalMs: 2400, pullMs: 1500, sweepStartMs: 250, sweepMs: 1400 } as const;

export type MomentState = {
  /** 0 at rest, 1 at the furthest pull-back. */
  pull: number;
  /** 0 to 1 while the light sweeps; null before it starts and after it ends. */
  sweep: number | null;
  done: boolean;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function momentState(elapsedMs: number): MomentState {
  if (elapsedMs >= MOMENT.totalMs) return { pull: 0, sweep: null, done: true };
  // sin^2 rises smoothly to 1 at the midpoint and falls back to 0, with no jump in speed at either end.
  const pull = Math.sin(Math.PI * clamp01(elapsedMs / MOMENT.pullMs)) ** 2;
  const t = (elapsedMs - MOMENT.sweepStartMs) / MOMENT.sweepMs;
  const sweep = t < 0 || t > 1 ? null : ease(t);
  return { pull, sweep, done: false };
}

const PULL_BACK = 0.24;

/** How much further from the car the camera stands at a given pull (1 means unchanged). */
export const pullScale = (pull: number): number => 1 + PULL_BACK * pull;
