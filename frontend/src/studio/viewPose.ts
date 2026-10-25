import type { CarDimensions } from '../lib/carGeometry';
import type { StudioView } from './types';

export type Pose = {
  position: [number, number, number];
  target: [number, number, number];
};

const MARGIN = 1.1;
const ORBIT_AZIMUTH = (35 * Math.PI) / 180;
const ORBIT_ELEVATION = (12 * Math.PI) / 180;

/** Distance at which a box of the given half-width and half-height fills the frame, with some air around it. */
function fit(halfWidth: number, halfHeight: number, fovDeg: number, aspect: number): number {
  const tan = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return Math.max(halfWidth / (tan * aspect), halfHeight / tan) * MARGIN;
}

/**
 * Where the camera stands for a named view. The car lies along x with its nose toward +x and its
 * left-to-right width along z. Every view looks at a point just below the roof line, on the car's axis.
 */
export function viewPose(
  view: StudioView,
  dims: CarDimensions,
  fovDeg: number,
  aspect: number,
): Pose {
  const target: Pose['target'] = [0, dims.height * 0.42, 0];
  const halfLength = dims.length / 2;
  const halfHeight = dims.height * 0.6;
  switch (view) {
    case 'side':
      return {
        position: [0, target[1], fit(halfLength, halfHeight, fovDeg, aspect)],
        target,
      };
    case 'front':
      return {
        position: [fit(dims.width / 2, halfHeight, fovDeg, aspect) + halfLength, target[1], 0],
        target,
      };
    case 'rear':
      return {
        position: [-(fit(dims.width / 2, halfHeight, fovDeg, aspect) + halfLength), target[1], 0],
        target,
      };
    case 'top':
      return {
        // A hair off vertical keeps the camera's up direction well defined.
        position: [0, fit(halfLength, dims.width / 2, fovDeg, aspect) + dims.height, 0.01],
        target,
      };
    case 'orbit': {
      const distance = fit(halfLength * 1.1, halfHeight, fovDeg, aspect) + halfLength * 0.4;
      return {
        position: [
          distance * Math.cos(ORBIT_ELEVATION) * Math.cos(ORBIT_AZIMUTH),
          target[1] + distance * Math.sin(ORBIT_ELEVATION),
          distance * Math.cos(ORBIT_ELEVATION) * Math.sin(ORBIT_AZIMUTH),
        ],
        target,
      };
    }
  }
}
