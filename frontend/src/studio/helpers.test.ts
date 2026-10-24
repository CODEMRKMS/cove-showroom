import { buildCarSpec } from '../lib/carSpec';
import { carDimensions } from '../lib/carGeometry';
import { createResourceCache } from './cache';
import { flakeNormalData } from './flake';
import { dampRgb, hexToRgb, rgbToHex } from './paint';
import { STUDIO_VIEWS } from './types';
import { viewPose } from './viewPose';

const dims = carDimensions(
  buildCarSpec({
    make: 'a',
    model: 'b',
    year: 2026,
    bodyStyle: 'SEDAN',
    colorOptions: ['#c0392b'],
  }),
);

describe('viewPose', () => {
  const pose = (view: (typeof STUDIO_VIEWS)[number], aspect = 16 / 9) =>
    viewPose(view, dims, 38, aspect);

  it('puts each named view on its own side of the car, looking at its middle', () => {
    expect(pose('side').position[2]).toBeGreaterThan(2);
    expect(Math.abs(pose('side').position[0])).toBeLessThan(0.01);
    expect(pose('front').position[0]).toBeGreaterThan(2);
    expect(pose('rear').position[0]).toBeLessThan(-2);
    expect(pose('top').position[1]).toBeGreaterThan(pose('side').position[1] + 2);
    for (const view of STUDIO_VIEWS) {
      const { target } = pose(view);
      expect(Math.abs(target[0])).toBeLessThan(0.01);
      expect(target[1]).toBeGreaterThan(0);
      expect(target[1]).toBeLessThan(dims.height);
    }
  });

  it('starts the free orbit at a three-quarter view from the front-right, slightly above', () => {
    const { position } = pose('orbit');
    expect(position[0]).toBeGreaterThan(0);
    expect(position[2]).toBeGreaterThan(0);
    expect(position[1]).toBeGreaterThan(dims.height * 0.4);
  });

  it('backs the camera off on a narrower screen so the whole car still fits', () => {
    const wide = pose('side', 16 / 9).position[2];
    const narrow = pose('side', 9 / 16).position[2];
    expect(narrow).toBeGreaterThan(wide);
  });

  it('only returns finite numbers', () => {
    for (const view of STUDIO_VIEWS) {
      for (const value of [...pose(view).position, ...pose(view).target]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe('paint colour animation', () => {
  it('converts hex to 0-1 channels and back', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(rgbToHex([1, 128 / 255, 0])).toBe('#ff8000');
  });

  it('moves toward the target without overshooting, and arrives', () => {
    const target = hexToRgb('#1d4ed8');
    let colour = hexToRgb('#c0392b');
    let previous = Infinity;
    for (let frame = 0; frame < 200; frame++) {
      colour = dampRgb(colour, target, 6, 1 / 60);
      const distance = Math.hypot(...colour.map((c, i) => c - target[i]!));
      expect(distance).toBeLessThanOrEqual(previous + 1e-12);
      previous = distance;
    }
    expect(rgbToHex(colour)).toBe('#1d4ed8');
  });

  it('does not move at all when no time has passed', () => {
    const start = hexToRgb('#c0392b');
    expect(dampRgb(start, hexToRgb('#ffffff'), 6, 0)).toEqual(start);
  });
});

describe('flakeNormalData', () => {
  it('fills a square RGBA texture and is the same every time for the same seed', () => {
    const a = flakeNormalData(32, 7);
    expect(a).toHaveLength(32 * 32 * 4);
    expect(flakeNormalData(32, 7)).toEqual(a);
    expect(flakeNormalData(32, 8)).not.toEqual(a);
  });

  it('is mostly flat (pointing out of the surface) with a scattering of tilted flakes', () => {
    const data = flakeNormalData(64, 3);
    let tilted = 0;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 2]).toBeGreaterThanOrEqual(180);
      expect(data[i + 3]).toBe(255);
      if (Math.abs(data[i]! - 128) > 6 || Math.abs(data[i + 1]! - 128) > 6) tilted += 1;
    }
    const share = tilted / (64 * 64);
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.4);
  });
});

describe('resource cache', () => {
  const make = () => ({
    disposed: 0,
    dispose() {
      this.disposed += 1;
    },
  });

  it('hands out one shared instance per key', () => {
    const cache = createResourceCache();
    const first = cache.acquire('body:SEDAN', make);
    expect(cache.acquire('body:SEDAN', make)).toBe(first);
    expect(cache.acquire('body:SUV', make)).not.toBe(first);
    expect(cache.size()).toBe(2);
  });

  it('disposes only when the last user lets go, then rebuilds on demand', () => {
    const cache = createResourceCache();
    const first = cache.acquire('tyre', make);
    cache.acquire('tyre', make);
    cache.release('tyre');
    expect(first.disposed).toBe(0);
    cache.release('tyre');
    expect(first.disposed).toBe(1);
    expect(cache.size()).toBe(0);
    expect(cache.acquire('tyre', make)).not.toBe(first);
  });

  it('ignores a release for a key it does not hold', () => {
    const cache = createResourceCache();
    expect(() => cache.release('nothing')).not.toThrow();
  });
});
