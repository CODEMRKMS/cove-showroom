import {
  chooseTier,
  dprFor,
  fallbackReason,
  probeFrameTime,
  readEnvironment,
  type DeviceInfo,
} from './quality';

const desktop: DeviceInfo = {
  devicePixelRatio: 2,
  hardwareConcurrency: 12,
  deviceMemory: 16,
  saveData: false,
  mobile: false,
  frameMs: 8,
};

describe('chooseTier', () => {
  it('gives a strong desktop the high tier', () => {
    expect(chooseTier(desktop)).toBe('high');
  });

  it('gives a mid-range laptop the medium tier', () => {
    expect(chooseTier({ ...desktop, hardwareConcurrency: 4, deviceMemory: 4 })).toBe('medium');
  });

  it.each([
    ['little memory', { deviceMemory: 2 }],
    ['two cores', { hardwareConcurrency: 2 }],
    ['Save-Data on', { saveData: true }],
    ['a slow frame probe', { frameMs: 45 }],
    ['a phone with few cores', { mobile: true, hardwareConcurrency: 4 }],
  ])('drops to low for %s', (_name, change) => {
    expect(chooseTier({ ...desktop, ...change })).toBe('low');
  });

  it('does not give a phone the high tier, however strong', () => {
    expect(chooseTier({ ...desktop, mobile: true })).toBe('medium');
  });

  it('copes with browsers that hide memory, core count and the probe', () => {
    const rest: DeviceInfo = { devicePixelRatio: 2, saveData: false, mobile: false };
    expect(chooseTier(rest)).toBe('medium');
  });

  it('does not let a slow probe on a strong desktop be ignored', () => {
    expect(chooseTier({ ...desktop, frameMs: 31 })).toBe('low');
    expect(chooseTier({ ...desktop, frameMs: 22 })).toBe('medium');
  });
});

describe('dprFor', () => {
  it('caps the pixel ratio per tier: 1.5 high, 1.25 medium, 1 low', () => {
    expect(dprFor('high', 3)).toBe(1.5);
    expect(dprFor('medium', 3)).toBe(1.25);
    expect(dprFor('low', 3)).toBe(1);
  });

  it('never goes above what the screen has, and never below 1', () => {
    expect(dprFor('high', 1)).toBe(1);
    expect(dprFor('high', 0)).toBe(1);
  });
});

describe('fallbackReason', () => {
  const ok = {
    webgl: true,
    reducedMotion: false,
    saveData: false,
    mobile: false,
    tier: 'high' as const,
  };

  it('is null when everything allows 3D', () => {
    expect(fallbackReason(ok)).toBeNull();
  });

  it('names the first reason 3D is not allowed', () => {
    expect(fallbackReason({ ...ok, webgl: false })).toBe('no-webgl');
    expect(fallbackReason({ ...ok, reducedMotion: true })).toBe('reduced-motion');
    expect(fallbackReason({ ...ok, saveData: true })).toBe('save-data');
    expect(fallbackReason({ ...ok, mobile: true, tier: 'low' })).toBe('low-tier-mobile');
  });

  it('keeps 3D on a phone that reaches the medium tier, and on a low-tier desktop', () => {
    expect(fallbackReason({ ...ok, mobile: true, tier: 'medium' })).toBeNull();
    expect(fallbackReason({ ...ok, tier: 'low' })).toBeNull();
  });

  it('reports a missing WebGL before anything else', () => {
    expect(fallbackReason({ ...ok, webgl: false, reducedMotion: true, saveData: true })).toBe(
      'no-webgl',
    );
  });
});

describe('readEnvironment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the window, navigator and media queries', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce') || query.includes('pointer: coarse'),
    }));
    vi.stubGlobal('navigator', {
      hardwareConcurrency: 6,
      deviceMemory: 8,
      connection: { saveData: true },
    });
    expect(readEnvironment()).toEqual({
      devicePixelRatio: 2,
      hardwareConcurrency: 6,
      deviceMemory: 8,
      saveData: true,
      mobile: true,
      reducedMotion: true,
    });
  });

  it('survives a browser with no matchMedia or connection info', () => {
    vi.stubGlobal('matchMedia', undefined);
    vi.stubGlobal('navigator', {});
    const env = readEnvironment();
    expect(env.saveData).toBe(false);
    expect(env.reducedMotion).toBe(false);
    expect(env.mobile).toBe(false);
  });
});

describe('probeFrameTime', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('averages the gap between animation frames', async () => {
    let now = 100;
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      now += 16;
      setTimeout(() => callback(now), 0);
      return 0;
    });
    expect(await probeFrameTime(5)).toBeCloseTo(16);
  });

  it('resolves null when there is no requestAnimationFrame', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    expect(await probeFrameTime()).toBeNull();
  });
});
