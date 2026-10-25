import { Box3, type BufferGeometry } from 'three';
import { CATEGORIES } from '../api/types';
import { carDimensions } from '../lib/carGeometry';
import { buildCarSpec } from '../lib/carSpec';
import {
  buildBodyGeometry,
  buildGlassGeometry,
  buildRimGeometry,
  buildTyreGeometry,
} from './geometry';

const specFor = (bodyStyle: (typeof CATEGORIES)[number]) =>
  buildCarSpec({ make: 'Cove', model: 'Test', year: 2026, bodyStyle, colorOptions: ['#c0392b'] });

const boxOf = (geometry: BufferGeometry) =>
  new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);

const allFinite = (geometry: BufferGeometry) =>
  Array.from(geometry.getAttribute('position').array).every(Number.isFinite) &&
  Array.from(geometry.getAttribute('normal').array).every(Number.isFinite);

describe('buildBodyGeometry', () => {
  it.each(CATEGORIES)('%s spans its own dimensions, centred on the car axis', (style) => {
    const spec = specFor(style);
    const d = carDimensions(spec);
    const box = boxOf(buildBodyGeometry(spec));
    expect(box.max.x - box.min.x).toBeCloseTo(d.length, 1);
    expect(box.max.z - box.min.z).toBeGreaterThan(d.width * 0.97);
    expect(box.max.z - box.min.z).toBeLessThan(d.width * 1.03);
    expect(box.min.z + box.max.z).toBeCloseTo(0, 2);
    expect(box.min.y).toBeGreaterThanOrEqual(d.clearance - 0.01);
    expect(box.max.y).toBeLessThanOrEqual(d.height + 0.01);
  });

  it.each(CATEGORIES)('%s has finite positions and normals and a texture mapping', (style) => {
    const geometry = buildBodyGeometry(specFor(style));
    expect(allFinite(geometry)).toBe(true);
    expect(geometry.getAttribute('uv')).toBeDefined();
    expect(geometry.getAttribute('position').count).toBeGreaterThan(500);
  });

  it('narrows toward the nose: the front tenth is slimmer than the middle', () => {
    const spec = specFor('SEDAN');
    const d = carDimensions(spec);
    const geometry = buildBodyGeometry(spec);
    const position = geometry.getAttribute('position');
    const widthWhere = (keep: (x: number) => boolean) => {
      let widest = 0;
      for (let i = 0; i < position.count; i++) {
        if (keep(position.getX(i))) widest = Math.max(widest, Math.abs(position.getZ(i)));
      }
      return widest;
    };
    const nose = widthWhere((x) => x > d.length * 0.4);
    const middle = widthWhere((x) => Math.abs(x) < d.length * 0.1);
    expect(nose).toBeLessThan(middle * 0.95);
  });

  // Builds the body geometry for every body style; under coverage instrumentation this is slow,
  // so it gets 30 s instead of Vitest's 5 s default.
  it('is a different shape for every body style', () => {
    const sizes = CATEGORIES.map((style) => {
      const box = boxOf(buildBodyGeometry(specFor(style)));
      return [box.max.x - box.min.x, box.max.y, box.max.z].map((n) => n.toFixed(3)).join('/');
    });
    expect(new Set(sizes).size).toBe(CATEGORIES.length);
  }, 30_000);
});

describe('buildGlassGeometry', () => {
  it('exists for a closed car, sits above the belt line and stays inside the roof', () => {
    const spec = specFor('SEDAN');
    const glass = buildGlassGeometry(spec)!;
    const box = boxOf(glass);
    expect(box.min.y).toBeGreaterThan(spec.profile.beltHeight * 0.0125 - 0.01);
    expect(box.max.y).toBeLessThan(carDimensions(spec).height);
    expect(allFinite(glass)).toBe(true);
  });

  it('is wider than the cabin sides so it shows as a window, not a hidden slab', () => {
    const spec = specFor('SEDAN');
    const glassWidth = boxOf(buildGlassGeometry(spec)!).max.z;
    expect(glassWidth).toBeGreaterThan(0.5);
  });

  it('is null for the convertible', () => {
    expect(buildGlassGeometry(specFor('CONVERTIBLE'))).toBeNull();
  });
});

describe('wheels', () => {
  it('builds a tyre whose outer radius is the wheel radius, lying across the car (z axis)', () => {
    const tyre = boxOf(buildTyreGeometry(0.35, 0.22));
    expect(tyre.max.x).toBeCloseTo(0.35, 2);
    expect(tyre.max.y).toBeCloseTo(0.35, 2);
    expect(tyre.max.z - tyre.min.z).toBeCloseTo(0.22, 2);
  });

  it('builds a rim that fits inside the tyre', () => {
    const rim = boxOf(buildRimGeometry(0.35, 0.22));
    expect(rim.max.x).toBeLessThan(0.35 * 0.8);
    expect(rim.max.x).toBeGreaterThan(0.35 * 0.55);
    expect(rim.max.z - rim.min.z).toBeLessThanOrEqual(0.22);
  });
});
