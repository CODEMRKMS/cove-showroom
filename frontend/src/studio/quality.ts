export type Tier = 'low' | 'medium' | 'high';

export type DeviceInfo = {
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  /** Gigabytes, rounded down to a power of two by the browser; Chromium only. */
  deviceMemory?: number;
  saveData: boolean;
  /** A touch-first device (coarse primary pointer). */
  mobile: boolean;
  /** Milliseconds per frame from a short probe, when one has run. */
  frameMs?: number;
};

export type Environment = Omit<DeviceInfo, 'frameMs'> & { reducedMotion: boolean };

/**
 * Picks how much the scene may spend. Low switches off everything optional; high is only for a strong
 * desktop whose probe ran fast. Unknown values (Safari and Firefox hide memory) default to medium
 * rather than guessing high.
 */
export function chooseTier(device: DeviceInfo): Tier {
  const { hardwareConcurrency: cores, deviceMemory: memory, frameMs, saveData, mobile } = device;
  if (saveData) return 'low';
  if (memory !== undefined && memory <= 2) return 'low';
  if (cores !== undefined && cores <= 2) return 'low';
  if (mobile && cores !== undefined && cores <= 4) return 'low';
  if (frameMs !== undefined && frameMs > 30) return 'low';

  const known = memory !== undefined && cores !== undefined && frameMs !== undefined;
  if (known && !mobile && memory >= 8 && cores >= 8 && frameMs <= 20) return 'high';
  return 'medium';
}

const DPR_CAP: Record<Tier, number> = { low: 1, medium: 1.25, high: 1.5 };

/** The pixel ratio to render at: the screen's, capped by tier, and never below 1. */
export function dprFor(tier: Tier, devicePixelRatio: number): number {
  return Math.max(1, Math.min(devicePixelRatio, DPR_CAP[tier]));
}

export type FallbackReason = 'no-webgl' | 'reduced-motion' | 'save-data' | 'low-tier-mobile';

type FallbackInput = {
  webgl: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  mobile: boolean;
  tier: Tier;
};

/** Why the page should show the SVG car instead of the 3D one, or null when 3D is allowed. */
export function fallbackReason(input: FallbackInput): FallbackReason | null {
  if (!input.webgl) return 'no-webgl';
  if (input.reducedMotion) return 'reduced-motion';
  if (input.saveData) return 'save-data';
  if (input.mobile && input.tier === 'low') return 'low-tier-mobile';
  return null;
}

type NetworkInformation = { saveData?: boolean };
type NavigatorWithHints = Navigator & { deviceMemory?: number; connection?: NetworkInformation };

const matches = (query: string): boolean =>
  typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;

/** Reads the browser's hints. Every API here is optional in some browser, so each read is guarded. */
export function readEnvironment(): Environment {
  const nav: NavigatorWithHints = typeof navigator === 'undefined' ? ({} as Navigator) : navigator;
  return {
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
    mobile: matches('(pointer: coarse)'),
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
  };
}

/** Average milliseconds per frame over a short run of animation frames. Resolves null if it cannot run. */
export function probeFrameTime(frames = 20): Promise<number | null> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let count = 0;
    let first = 0;
    const tick = (now: number) => {
      if (count === 0) first = now;
      count += 1;
      if (count > frames) resolve((now - first) / frames);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
