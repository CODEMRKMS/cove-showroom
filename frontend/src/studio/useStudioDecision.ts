import { useEffect, useState } from 'react';
import { shouldPlayIntro } from './intro';
import {
  chooseTier,
  dprFor,
  fallbackReason,
  probeFrameTime,
  readEnvironment,
  type Tier,
} from './quality';
import { hasWebGL } from './webgl';

export type Decision =
  | { status: 'pending' }
  | { status: 'svg' }
  | { status: '3d'; tier: Tier; dpr: number; intro: boolean };

// One frame-time probe per page load, shared by everything on it.
let probe: Promise<number | null> | undefined;
const frameTime = () => (probe ??= probeFrameTime());

/**
 * Whether this device should get 3D, and at what tier and pixel ratio. Starts "pending" (callers draw the SVG),
 * checks everything knowable without a probe first so no frames are spent on a visitor who gets the SVG, then
 * runs the shared frame-time probe. Decided once, on mount. `wantIntro` also asks to play the clay-to-render
 * intro, which is granted once per browser session.
 */
export function useStudioDecision(wantIntro = false): Decision {
  const [decision, setDecision] = useState<Decision>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;
    const env = readEnvironment();
    const webgl = hasWebGL();
    const blocked = fallbackReason({ ...env, webgl, tier: 'medium' }) !== null;
    void (blocked ? Promise.resolve(null) : frameTime()).then((frameMs) => {
      if (cancelled) return;
      const tier = chooseTier({ ...env, frameMs: frameMs ?? undefined });
      setDecision(
        blocked || fallbackReason({ ...env, webgl, tier })
          ? { status: 'svg' }
          : {
              status: '3d',
              tier,
              dpr: dprFor(tier, env.devicePixelRatio),
              intro: wantIntro && shouldPlayIntro({ reducedMotion: env.reducedMotion }),
            },
      );
    });
    return () => {
      cancelled = true;
    };
    // Decided once, on mount: a later change of `wantIntro` must not re-run the frame probe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return decision;
}
