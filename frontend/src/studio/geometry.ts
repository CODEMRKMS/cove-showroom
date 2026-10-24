import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Shape,
  Vector2,
} from 'three';
import {
  mergeGeometries,
  mergeVertices,
  toCreasedNormals,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bodyOutline, carDimensions, taperFactor } from '../lib/carGeometry';
import { greenhouse } from '../lib/carParts';
import type { CarSpec } from '../lib/carSpec';
import { refineLongEdges } from './refine';

/** three.js geometry for the procedural car. Needs no GPU, so it runs (and is tested) in node. */

const BEVEL_THICKNESS = 0.1;
const BEVEL_SIZE = 0.08;
const BEVEL_SEGMENTS = 8;
// Neighbouring faces closer than this angle share a smooth normal; sharper edges stay crisp.
const CREASE = (17 * Math.PI) / 180;
const GLASS_PROUD = 0.02;

/** The outline with repeated points removed: a zero-length edge breaks the extruder's bevel maths. */
function shapeFrom(points: readonly (readonly [number, number])[]): Shape {
  const unique: Vector2[] = [];
  for (const [x, y] of points) {
    const last = unique.at(-1);
    if (!last || Math.hypot(last.x - x, last.y - y) > 1e-5) unique.push(new Vector2(x, y));
  }
  return new Shape(unique);
}

/** Longest triangle edge allowed before the width taper is applied (metres). */
const MAX_EDGE = 0.16;

/**
 * Turns a raw extrusion into render-ready geometry: weld the vertices, cut long edges so the taper has
 * something to bend, texture-map it, squeeze the width by the spec's taper, and compute normals that are
 * smooth within the crease angle and crisp beyond it.
 */
function finish(extruded: BufferGeometry, spec: CarSpec, crease: number): BufferGeometry {
  extruded.deleteAttribute('normal');
  extruded.deleteAttribute('uv');
  extruded.clearGroups();
  const welded = mergeVertices(extruded, 1e-5);
  extruded.dispose();
  const fine = refineLongEdges(welded, MAX_EDGE);
  welded.dispose();

  const position = fine.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    // One continuous planar mapping, slanted so no face is seen edge-on; paint flake is noise, so
    // stretching on steep faces does not show.
    uv[i * 2] = x + z * 0.6;
    uv[i * 2 + 1] = y + z * 0.35;
    position.setZ(i, z * taperFactor(spec, x, y));
  }
  fine.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const smooth = toCreasedNormals(fine, crease);
  fine.dispose();
  return smooth;
}

/** The painted shell: the side profile pushed out to the car's width, bevelled, then tapered. */
export function buildBodyGeometry(spec: CarSpec): BufferGeometry {
  const { width } = carDimensions(spec);
  const depth = width - 2 * BEVEL_THICKNESS;
  const extruded = new ExtrudeGeometry(shapeFrom(bodyOutline(spec)), {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    // Negative offset pulls the bevel inward so the flat flank stays exactly on the outline.
    bevelOffset: -BEVEL_SIZE,
    bevelSegments: BEVEL_SEGMENTS,
  });
  extruded.translate(0, 0, -depth / 2);
  return finish(extruded, spec, CREASE);
}

/** The side windows: a slab slightly wider than the body so it shows on both flanks. Null for an open car. */
export function buildGlassGeometry(spec: CarSpec): BufferGeometry | null {
  const outline = greenhouse(spec);
  if (!outline) return null;
  const depth = carDimensions(spec).width + 2 * GLASS_PROUD;
  const glass = new ExtrudeGeometry(shapeFrom(outline), {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: false,
  });
  glass.translate(0, 0, -depth / 2);
  return finish(glass, spec, Math.PI / 4);
}

const TYRE_SEGMENTS = 40;

/** A tyre with rounded shoulders, lying across the car: axis along z, outer radius `radius`. */
export function buildTyreGeometry(radius: number, width: number): BufferGeometry {
  const half = width / 2;
  const profile = [
    [0.7, -half],
    [0.84, -half],
    [0.95, -half * 0.8],
    [1, -half * 0.45],
    [1, half * 0.45],
    [0.95, half * 0.8],
    [0.84, half],
    [0.7, half],
    [0.7, -half],
  ].map(([r, y]) => new Vector2(r! * radius, y));
  const tyre = new LatheGeometry(profile, TYRE_SEGMENTS);
  tyre.rotateX(Math.PI / 2);
  return tyre;
}

const SPOKES = 5;

/** A dished alloy rim with five spokes, sized to sit inside the tyre. */
export function buildRimGeometry(radius: number, width: number): BufferGeometry {
  const barrel = new LatheGeometry(
    [
      [0.04, 0.3],
      [0.15, 0.33],
      [0.3, 0.28],
      [0.66, 0.26],
      [0.7, 0.2],
      [0.7, -0.36],
      [0.66, -0.36],
      [0.66, 0.2],
    ].map(([r, y]) => new Vector2(r! * radius, y! * width)),
    TYRE_SEGMENTS,
  );
  // The lathe turns about y; the spokes lie in the xy plane, so lay the barrel on its side first.
  barrel.rotateX(Math.PI / 2);
  const parts: BufferGeometry[] = [barrel];
  for (let spoke = 0; spoke < SPOKES; spoke++) {
    const bar = new BoxGeometry(radius * 0.62, radius * 0.1, width * 0.12);
    bar.translate(radius * 0.35, 0, width * 0.2);
    bar.rotateZ((spoke * Math.PI * 2) / SPOKES);
    parts.push(bar);
  }
  const rim = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return rim;
}
