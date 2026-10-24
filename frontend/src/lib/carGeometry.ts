import type { BodyStyle } from '../api/types';
import type { CarSpec } from './carSpec';

/**
 * Pure geometry for the 3D car, derived from the same CarSpec the SVG illustration uses. Spec lengths
 * are SVG units; here they become metres, with the car centred on x = 0, the nose toward +x and the
 * floor at y = 0. Nothing in this file touches three.js, so it is unit-tested directly.
 */
export const WORLD_SCALE = 0.0125;

export type Vec2 = readonly [x: number, y: number];

/** Ground clearance in spec units, the same as the SVG drawing. */
const CLEARANCE_UNITS = 17;
/** Spec units. The bumper top sits this far above the sill; the rounded corners start there. */
const BUMPER_UNITS = 14;
/** Body width in metres per style: sports cars are wide, hatchbacks narrow. */
const WIDTHS: Record<BodyStyle, number> = {
  HATCHBACK: 1.75,
  SEDAN: 1.82,
  SUV: 1.92,
  COUPE: 1.85,
  CONVERTIBLE: 1.85,
  TRUCK: 2.0,
  EV: 1.88,
  SPORTS: 1.98,
};

export type CarDimensions = {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  clearance: number;
  wheelRadius: number;
  /** x of the base of the rear window and of the windscreen: where the cabin begins and ends. */
  cabinStart: number;
  cabinEnd: number;
};

const centreOf = (spec: CarSpec) => (spec.profile.tailX + spec.profile.noseX) / 2;
const toWorldX = (spec: CarSpec, x: number) => (x - centreOf(spec)) * WORLD_SCALE;

/** A point in spec units (x along the car, h above the floor) as metres, car centred on x = 0. */
export const toWorldPoint = (spec: CarSpec, x: number, h: number): Vec2 => [
  toWorldX(spec, x),
  h * WORLD_SCALE,
];

export function carDimensions(spec: CarSpec): CarDimensions {
  const { profile: p, wheels } = spec;
  return {
    length: (p.noseX - p.tailX) * WORLD_SCALE,
    width: WIDTHS[spec.bodyStyle],
    height: p.roofHeight * WORLD_SCALE,
    wheelbase: (wheels.frontX - wheels.rearX) * WORLD_SCALE,
    clearance: CLEARANCE_UNITS * WORLD_SCALE,
    wheelRadius: wheels.radius * WORLD_SCALE,
    cabinStart: toWorldX(spec, p.rearGlassBaseX),
    cabinEnd: toWorldX(spec, p.windscreenBaseX),
  };
}

export type WheelPlacement = { axle: 'rear' | 'front'; x: number; y: number; radius: number };

/** Rear wheel first, then front. Each wheel's centre is one radius above the floor. */
export function wheelPositions(spec: CarSpec): [WheelPlacement, WheelPlacement] {
  const radius = spec.wheels.radius * WORLD_SCALE;
  return [
    { axle: 'rear', x: toWorldX(spec, spec.wheels.rearX), y: radius, radius },
    { axle: 'front', x: toWorldX(spec, spec.wheels.frontX), y: radius, radius },
  ];
}

/**
 * Chaikin corner cutting: each pass replaces every corner with two points a quarter of the way along
 * its neighbouring edges. The curve stays inside the hull of the input and never overshoots, which a
 * spline through sharp roof corners would. End points stay where they are.
 */
export function chaikin(points: readonly Vec2[], iterations: number): Vec2[] {
  let current = points.map(([x, y]): Vec2 => [x, y]);
  if (points.length < 3) return current;
  for (let pass = 0; pass < iterations; pass++) {
    const next: Vec2[] = [current[0]!];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i]!;
      const [bx, by] = current[i + 1]!;
      if (i > 0) next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by]);
      if (i < current.length - 2) next.push([0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    next.push(current[current.length - 1]!);
    current = next;
  }
  return current;
}

const ARC_STEPS = 12;
const ARCH_GAP_UNITS = 4;
const FENDER_MARGIN_UNITS = 12;

/**
 * The closed side profile in metres, going over the top from tail to nose and back along the sill.
 * The top line is the spec's roof/hood/deck polyline with its corners cut; the sill has a round arch
 * above each wheel, and the body is lifted into a fender over each wheel so no tyre pokes through.
 */
export function bodyOutline(spec: CarSpec): Vec2[] {
  const { profile: p, wheels } = spec;
  const bumperTop = CLEARANCE_UNITS + BUMPER_UNITS;

  const top: Vec2[] =
    spec.roof === 'open'
      ? [
          [p.tailX, bumperTop],
          [p.tailX, p.trunkHeight],
          [p.windscreenBaseX - 60, p.beltHeight],
          [p.windscreenBaseX, p.beltHeight],
          [p.noseX - 36, p.hoodHeight],
          [p.noseX, p.hoodHeight - 10],
          [p.noseX, bumperTop],
        ]
      : [
          [p.tailX, bumperTop],
          [p.tailX, p.trunkHeight],
          [p.rearGlassBaseX, p.trunkHeight],
          [p.rearGlassTopX, p.roofHeight],
          [p.windscreenTopX, p.roofHeight],
          [p.windscreenBaseX, p.beltHeight],
          [p.noseX - 36, p.hoodHeight],
          [p.noseX, p.hoodHeight - 10],
          [p.noseX, bumperTop],
        ];

  // Fender lift: a cosine-squared hump over each wheel, tall enough to clear the tyre.
  const fenderHeight = (x: number) =>
    [wheels.rearX, wheels.frontX].reduce((best, wheelX) => {
      const reach = wheels.radius + ARCH_GAP_UNITS + 14;
      const t = Math.min(Math.abs(x - wheelX) / reach, 1);
      const hump = (2 * wheels.radius + FENDER_MARGIN_UNITS) * Math.cos((t * Math.PI) / 2) ** 2;
      return Math.max(best, hump);
    }, 0);
  const smooth = chaikin(top, 3).map(([x, y]): Vec2 => [x, Math.max(y, fenderHeight(x))]);

  // Sill from the nose back to the tail, stepping up around each wheel (front wheel first).
  const sill: Vec2[] = [[p.noseX, CLEARANCE_UNITS]];
  const archRadius = wheels.radius + ARCH_GAP_UNITS;
  const start = Math.asin((CLEARANCE_UNITS - wheels.radius) / archRadius);
  for (const wheelX of [wheels.frontX, wheels.rearX]) {
    for (let step = 0; step <= ARC_STEPS; step++) {
      const angle = start + ((Math.PI - 2 * start) * step) / ARC_STEPS;
      sill.push([
        wheelX + archRadius * Math.cos(angle),
        wheels.radius + archRadius * Math.sin(angle),
      ]);
    }
  }
  sill.push([p.tailX, CLEARANCE_UNITS]);

  return [...smooth, ...sill].map(([x, y]): Vec2 => [
    (x - centreOf(spec)) * WORLD_SCALE,
    y * WORLD_SCALE,
  ]);
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * How much of the full body width remains at a point on the side profile (x along the car, y up,
 * both in metres): the nose narrows most, the tail a little, and the glasshouse above the belt line
 * tucks in. 1 means full width. Used to squeeze the extruded body in a vertex pass.
 */
export function taperFactor(spec: CarSpec, x: number, y: number): number {
  const { length, height } = carDimensions(spec);
  const half = length / 2;
  const along = Math.min(Math.abs(x) / half, 1);
  const ends = x >= 0 ? 0.14 * smoothstep(0.5, 1, along) : 0.07 * smoothstep(0.6, 1, along);
  const belt = spec.profile.beltHeight * WORLD_SCALE;
  const tuck = 0.22 * smoothstep(belt, height, y);
  return (1 - ends) * (1 - tuck);
}
