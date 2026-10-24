import { CATEGORIES } from '../api/types';
import { buildCarSpec } from './carSpec';
import { carDimensions, wheelPositions } from './carGeometry';
import { doorSeams, greenhouse, lightPositions, windowSlabs } from './carParts';

const specFor = (bodyStyle: (typeof CATEGORIES)[number]) =>
  buildCarSpec({ make: 'Cove', model: 'Test', year: 2026, bodyStyle, colorOptions: ['#c0392b'] });

describe('greenhouse (the side-window shape)', () => {
  it.each(CATEGORIES.filter((style) => style !== 'CONVERTIBLE'))(
    '%s has four corners, inside the cabin and under the roof',
    (style) => {
      const spec = specFor(style);
      const d = carDimensions(spec);
      const glass = greenhouse(spec)!;
      expect(glass).toHaveLength(4);
      for (const [x, y] of glass) {
        expect(x).toBeGreaterThanOrEqual(-d.length / 2);
        expect(x).toBeLessThanOrEqual(d.length / 2);
        expect(y).toBeLessThan(d.height);
        expect(y).toBeGreaterThan(spec.profile.beltHeight * 0.0125 - 0.01);
      }
    },
  );

  it('is absent on the convertible, which has no roof to hold side windows', () => {
    expect(greenhouse(specFor('CONVERTIBLE'))).toBeNull();
  });
});

describe('windowSlabs (windscreen and rear window)', () => {
  it('gives a closed car both, sloping up toward the middle of the car', () => {
    const { windscreen, rearWindow } = windowSlabs(specFor('SEDAN'));
    expect(windscreen!.top[1]).toBeGreaterThan(windscreen!.base[1]);
    expect(windscreen!.top[0]).toBeLessThan(windscreen!.base[0]);
    expect(rearWindow!.top[1]).toBeGreaterThan(rearWindow!.base[1]);
    expect(rearWindow!.top[0]).toBeGreaterThan(rearWindow!.base[0]);
  });

  it('gives the convertible a windscreen and no rear window', () => {
    const { windscreen, rearWindow } = windowSlabs(specFor('CONVERTIBLE'));
    expect(windscreen).not.toBeNull();
    expect(rearWindow).toBeNull();
  });

  it('keeps the truck cab window upright and sets it ahead of the open bed', () => {
    const spec = specFor('TRUCK');
    const { rearWindow } = windowSlabs(spec);
    expect(Math.abs(rearWindow!.top[0] - rearWindow!.base[0])).toBeLessThan(0.1);
    expect(rearWindow!.base[0]).toBeGreaterThan(-carDimensions(spec).length / 2 + 1);
  });
});

describe('doorSeams', () => {
  it.each(CATEGORIES)(
    "%s seams are upright lines between the wheels' arches and the cabin",
    (style) => {
      const spec = specFor(style);
      const [rear, front] = wheelPositions(spec);
      const seams = doorSeams(spec);
      expect(seams.length).toBeGreaterThanOrEqual(1);
      for (const seam of seams) {
        expect(seam.bottom).toBeLessThan(seam.top);
        expect(seam.x).toBeGreaterThan(rear!.x);
        expect(seam.x).toBeLessThan(front!.x);
      }
    },
  );

  it('gives four-door bodies two seams and two-door bodies one', () => {
    expect(doorSeams(specFor('SEDAN'))).toHaveLength(2);
    expect(doorSeams(specFor('SUV'))).toHaveLength(2);
    expect(doorSeams(specFor('COUPE'))).toHaveLength(1);
    expect(doorSeams(specFor('SPORTS'))).toHaveLength(1);
  });
});

describe('lightPositions', () => {
  it.each(CATEGORIES)('%s has headlights at the nose and tail lights at the tail', (style) => {
    const spec = specFor(style);
    const d = carDimensions(spec);
    const { head, tail } = lightPositions(spec);
    expect(head.x).toBeGreaterThan(d.length / 2 - 0.5);
    expect(tail.x).toBeLessThan(-d.length / 2 + 0.5);
    expect(head.y).toBeGreaterThan(d.clearance);
    expect(head.y).toBeLessThan(d.height);
    expect(tail.y).toBeGreaterThan(d.clearance);
    expect(tail.y).toBeLessThan(d.height);
  });
});
