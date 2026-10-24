import { CATEGORIES, type BodyStyle } from '../api/types';
import { buildCarSpec } from './carSpec';
import {
  WORLD_SCALE,
  bodyOutline,
  carDimensions,
  chaikin,
  taperFactor,
  wheelPositions,
} from './carGeometry';

const specFor = (bodyStyle: BodyStyle) =>
  buildCarSpec({ make: 'Cove', model: 'Test', year: 2026, bodyStyle, colorOptions: ['#c0392b'] });

describe('carDimensions', () => {
  it.each(CATEGORIES)('%s has sane proportions in metres', (style) => {
    const d = carDimensions(specFor(style));
    expect(d.length).toBeGreaterThan(3.5);
    expect(d.length).toBeLessThan(5.5);
    expect(d.width).toBeGreaterThan(1.6);
    expect(d.width).toBeLessThan(2.2);
    expect(d.height).toBeGreaterThan(1.0);
    expect(d.height).toBeLessThan(2.1);
    expect(d.wheelbase).toBeLessThan(d.length);
    expect(d.clearance).toBeGreaterThan(0.1);
    expect(d.clearance).toBeLessThan(d.height / 3);
  });

  it.each(CATEGORIES)('%s keeps the cabin inside the body, ahead of the tail', (style) => {
    const d = carDimensions(specFor(style));
    expect(d.cabinStart).toBeGreaterThanOrEqual(-d.length / 2);
    expect(d.cabinEnd).toBeLessThanOrEqual(d.length / 2);
    expect(d.cabinStart).toBeLessThan(d.cabinEnd);
  });

  it('makes sports cars low and wide, and SUVs and trucks tall', () => {
    const sports = carDimensions(specFor('SPORTS'));
    const sedan = carDimensions(specFor('SEDAN'));
    const suv = carDimensions(specFor('SUV'));
    const truck = carDimensions(specFor('TRUCK'));
    expect(sports.height).toBeLessThan(sedan.height);
    expect(suv.height).toBeGreaterThan(sedan.height);
    expect(truck.height).toBeGreaterThan(sedan.height);
    expect(sports.width / sports.height).toBeGreaterThan(suv.width / suv.height);
  });
});

describe('wheelPositions', () => {
  it.each(CATEGORIES)('%s puts two wheels on the floor, rear behind front', (style) => {
    const spec = specFor(style);
    const [rear, front] = wheelPositions(spec);
    expect(rear!.x).toBeLessThan(front!.x);
    expect(rear!.y).toBeCloseTo(rear!.radius);
    expect(front!.y).toBeCloseTo(front!.radius);
    expect(front!.x - rear!.x).toBeCloseTo(carDimensions(spec).wheelbase);
  });

  it('keeps each wheel inside the car length', () => {
    for (const style of CATEGORIES) {
      const half = carDimensions(specFor(style)).length / 2;
      for (const wheel of wheelPositions(specFor(style))) {
        expect(Math.abs(wheel.x) + wheel.radius).toBeLessThan(half);
      }
    }
  });
});

describe('chaikin', () => {
  const corner: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];

  it('keeps the end points and adds points', () => {
    const out = chaikin(corner, 2);
    expect(out[0]).toEqual([0, 0]);
    expect(out.at(-1)).toEqual([1, 1]);
    expect(out.length).toBeGreaterThan(corner.length);
  });

  it('cuts the corner without leaving the original bounding box', () => {
    for (const [x, y] of chaikin(corner, 3)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    expect(chaikin(corner, 3)).not.toContainEqual([1, 0]);
  });

  it('returns the input for zero iterations and for fewer than three points', () => {
    expect(chaikin(corner, 0)).toEqual(corner);
    expect(
      chaikin(
        [
          [0, 0],
          [2, 2],
        ],
        3,
      ),
    ).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });
});

describe('bodyOutline', () => {
  it.each(CATEGORIES)(
    '%s is a finite closed shape that stays within its own dimensions',
    (style) => {
      const spec = specFor(style);
      const d = carDimensions(spec);
      const outline = bodyOutline(spec);
      expect(outline.length).toBeGreaterThan(30);
      for (const [x, y] of outline) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(d.length / 2 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(d.clearance - 1e-6);
        expect(y).toBeLessThanOrEqual(d.height + 1e-6);
      }
      // An open car's windscreen frame is separate glass, so only closed roofs reach the full height.
      if (style !== 'CONVERTIBLE')
        expect(Math.max(...outline.map(([, y]) => y))).toBeCloseTo(d.height, 1);
    },
  );

  it('cuts wheel arches: the underside rises above the sill next to each wheel', () => {
    const spec = specFor('SEDAN');
    const d = carDimensions(spec);
    for (const wheel of wheelPositions(spec)) {
      const nearWheel = bodyOutline(spec).filter(
        ([x]) => Math.abs(x - wheel.x) < wheel.radius * 0.5,
      );
      expect(Math.max(...nearWheel.map(([, y]) => y))).toBeGreaterThan(wheel.radius + d.clearance);
    }
  });

  it('gives every body style its own silhouette, not a recolour', () => {
    // Compare the roof-line height at 24 evenly spaced positions, as a fraction of car length.
    const heightAt = (style: BodyStyle) => {
      const spec = specFor(style);
      const d = carDimensions(spec);
      const outline = bodyOutline(spec);
      return Array.from({ length: 24 }, (_, i) => {
        const x = -d.length / 2 + ((i + 0.5) / 24) * d.length;
        const near = outline.filter(([ox]) => Math.abs(ox - x) < d.length / 48);
        return near.length ? Math.max(...near.map(([, y]) => y)) / d.length : 0;
      });
    };
    for (let a = 0; a < CATEGORIES.length; a++) {
      for (let b = a + 1; b < CATEGORIES.length; b++) {
        const first = heightAt(CATEGORIES[a]!);
        const second = heightAt(CATEGORIES[b]!);
        const worst = Math.max(...first.map((h, i) => Math.abs(h - second[i]!)));
        expect(worst, `${CATEGORIES[a]} vs ${CATEGORIES[b]}`).toBeGreaterThan(0.012);
      }
    }
  });

  it('leaves the convertible roofless: its top never rises above the windscreen', () => {
    const spec = specFor('CONVERTIBLE');
    const d = carDimensions(spec);
    const behindWindscreen = bodyOutline(spec).filter(([x]) => x < d.cabinEnd - 0.5);
    expect(Math.max(...behindWindscreen.map(([, y]) => y))).toBeLessThan(
      spec.profile.beltHeight * WORLD_SCALE + 0.15,
    );
  });
});

describe('taperFactor', () => {
  const spec = specFor('SEDAN');
  const d = carDimensions(spec);

  it('is full width mid-car at shoulder height and narrows toward both ends', () => {
    expect(taperFactor(spec, 0, 0.5)).toBeCloseTo(1);
    expect(taperFactor(spec, d.length / 2, 0.5)).toBeLessThan(0.95);
    expect(taperFactor(spec, -d.length / 2, 0.5)).toBeLessThan(0.98);
  });

  it('tucks the roof in so the glasshouse is narrower than the body', () => {
    expect(taperFactor(spec, 0, d.height)).toBeLessThan(taperFactor(spec, 0, 0.5));
  });

  it('never collapses to nothing', () => {
    for (const x of [-d.length, -d.length / 2, 0, d.length / 2, d.length]) {
      for (const y of [0, 0.5, d.height, d.height * 2]) {
        const factor = taperFactor(spec, x, y);
        expect(factor).toBeGreaterThan(0.5);
        expect(factor).toBeLessThanOrEqual(1);
      }
    }
  });
});
