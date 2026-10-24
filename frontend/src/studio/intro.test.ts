import { INTRO, introState, shouldPlayIntro, sweepX } from './intro';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe('introState', () => {
  it('holds the clay look first, then sweeps, then is done', () => {
    expect(introState(0)).toMatchObject({ phase: 'hold', sweep: 0, done: false });
    expect(introState(INTRO.holdMs - 1)).toMatchObject({ phase: 'hold', sweep: 0 });
    expect(introState(INTRO.holdMs + INTRO.sweepMs / 2).phase).toBe('sweep');
    expect(introState(INTRO.holdMs + INTRO.sweepMs)).toMatchObject({
      phase: 'done',
      sweep: 1,
      done: true,
    });
    expect(introState(60_000).done).toBe(true);
  });

  it('eases the sweep: monotonic, 0 to 1, slow at both ends', () => {
    let previous = 0;
    for (let ms = INTRO.holdMs; ms <= INTRO.holdMs + INTRO.sweepMs; ms += 40) {
      const { sweep } = introState(ms);
      expect(sweep).toBeGreaterThanOrEqual(previous);
      previous = sweep;
    }
    const early = introState(INTRO.holdMs + INTRO.sweepMs * 0.1).sweep;
    const late = introState(INTRO.holdMs + INTRO.sweepMs * 0.9).sweep;
    expect(early).toBeLessThan(0.1);
    expect(late).toBeGreaterThan(0.9);
  });

  it('treats negative time as the start', () => {
    expect(introState(-50)).toMatchObject({ phase: 'hold', sweep: 0 });
  });

  it('keeps the whole intro under three seconds', () => {
    expect(INTRO.holdMs + INTRO.sweepMs).toBeLessThan(3000);
  });
});

describe('sweepX', () => {
  it('starts behind the tail and ends past the nose', () => {
    expect(sweepX(0, 4)).toBeLessThan(-2);
    expect(sweepX(1, 4)).toBeGreaterThan(2);
    expect(sweepX(0.5, 4)).toBeCloseTo(0);
  });
});

describe('shouldPlayIntro', () => {
  it('plays once per session: the first call says yes and marks it, the second says no', () => {
    const storage = memory();
    expect(shouldPlayIntro({ reducedMotion: false, storage })).toBe(true);
    expect(shouldPlayIntro({ reducedMotion: false, storage })).toBe(false);
  });

  it('never plays under reduced motion, and does not use up the session flag', () => {
    const storage = memory();
    expect(shouldPlayIntro({ reducedMotion: true, storage })).toBe(false);
    expect(shouldPlayIntro({ reducedMotion: false, storage })).toBe(true);
  });

  it('still plays at most once per page load when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const first = shouldPlayIntro({ reducedMotion: false, storage: broken });
    const second = shouldPlayIntro({ reducedMotion: false, storage: broken });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
