import type { BodyStyle } from '../api/types';
import { WORLD_SCALE, carDimensions, toWorldPoint, wheelPositions, type Vec2 } from './carGeometry';
import type { CarSpec } from './carSpec';

/** Where the smaller parts of the 3D car go, in metres on the same axes as carGeometry. Pure, no three.js. */

/** The side-window shape: four corners under the roof and above the belt line. Null for an open car. */
export function greenhouse(spec: CarSpec): [Vec2, Vec2, Vec2, Vec2] | null {
  if (spec.roof === 'open') return null;
  const p = spec.profile;
  return [
    toWorldPoint(spec, p.rearGlassTopX + 12, p.roofHeight - 9),
    toWorldPoint(spec, p.windscreenTopX - 8, p.roofHeight - 9),
    toWorldPoint(spec, p.windscreenBaseX - 14, p.beltHeight + 3),
    toWorldPoint(spec, p.rearGlassBaseX + 16, p.beltHeight + 3),
  ];
}

export type Slab = { base: Vec2; top: Vec2 };

/** Windscreen and rear window as a line along each slanted face, from the lower edge to the upper one. */
export function windowSlabs(spec: CarSpec): { windscreen: Slab | null; rearWindow: Slab | null } {
  const p = spec.profile;
  return {
    windscreen: {
      base: toWorldPoint(spec, p.windscreenBaseX, p.beltHeight),
      top: toWorldPoint(spec, p.windscreenTopX, p.roofHeight),
    },
    rearWindow:
      spec.roof === 'open'
        ? null
        : {
            base: toWorldPoint(spec, p.rearGlassBaseX, p.trunkHeight),
            top: toWorldPoint(spec, p.rearGlassTopX, p.roofHeight),
          },
  };
}

const FOUR_DOOR: ReadonlySet<BodyStyle> = new Set(['HATCHBACK', 'SEDAN', 'SUV', 'EV']);
// Positions along the wheelbase, 0 at the rear axle and 1 at the front axle.
const FOUR_DOOR_SEAMS = [0.34, 0.66];
const TWO_DOOR_SEAMS = [0.62];
const SEAM_FOOT = 0.06;

export type Seam = { x: number; bottom: number; top: number };

/** Upright door seams on the flank: two on four-door bodies, one on the rest. */
export function doorSeams(spec: CarSpec): Seam[] {
  const [rear, front] = wheelPositions(spec);
  const clearance = toWorldPoint(spec, 0, 17)[1];
  const top = spec.profile.beltHeight * WORLD_SCALE;
  const along = FOUR_DOOR.has(spec.bodyStyle) ? FOUR_DOOR_SEAMS : TWO_DOOR_SEAMS;
  return along.map((t) => ({
    x: rear.x + t * (front.x - rear.x),
    bottom: clearance + SEAM_FOOT,
    top,
  }));
}

/** Centre of the headlight strip on the nose and of the tail light on the tail. */
export function lightPositions(spec: CarSpec): {
  head: { x: number; y: number };
  tail: { x: number; y: number };
} {
  const p = spec.profile;
  const bumperTop = 31;
  const [headX, headY] = toWorldPoint(spec, p.noseX, (p.hoodHeight - 10 + bumperTop) / 2);
  const [tailX, tailY] = toWorldPoint(spec, p.tailX, (p.trunkHeight + bumperTop) / 2);
  return { head: { x: headX, y: headY }, tail: { x: tailX, y: tailY } };
}

export type HotspotId = 'body' | 'paint' | 'stock';
export type Anchor = {
  id: HotspotId;
  position: [number, number, number];
  /** Outward direction of the surface the marker sits on; markers facing away from the camera fade out. */
  normal: [number, number, number];
};

/** Where the three spec markers sit: on the roof, on the right flank, and on the tail. */
export function hotspotAnchors(spec: CarSpec): [Anchor, Anchor, Anchor] {
  const p = spec.profile;
  const { length, width, height } = carDimensions(spec);
  const [roofX] = toWorldPoint(spec, (p.rearGlassTopX + p.windscreenTopX) / 2, 0);
  const [doorX] = toWorldPoint(spec, (p.rearGlassBaseX + p.windscreenBaseX) / 2, 0);
  return [
    { id: 'body', position: [roofX, height + 0.02, 0], normal: [0, 1, 0] },
    {
      id: 'paint',
      position: [doorX, p.beltHeight * WORLD_SCALE - 0.12, width / 2],
      normal: [0, 0, 1],
    },
    {
      id: 'stock',
      position: [-length / 2, p.trunkHeight * WORLD_SCALE - 0.1, 0],
      normal: [-1, 0, 0],
    },
  ];
}
