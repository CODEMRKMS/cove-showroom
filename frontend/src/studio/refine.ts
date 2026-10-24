import { BufferAttribute, BufferGeometry } from 'three';

const MAX_PASSES = 12;

/**
 * Splits triangles until no edge is longer than `maxEdge`, by cutting each long edge at its midpoint.
 * Whether an edge is long depends only on its two ends, so both triangles that share it cut it the same
 * way: no T-junctions, no cracks when the vertices are moved afterwards. Takes an indexed mesh and
 * returns a new one with positions and an index only; the caller recomputes normals and UVs.
 */
export function refineLongEdges(geometry: BufferGeometry, maxEdge: number): BufferGeometry {
  const positions = Array.from(geometry.getAttribute('position').array);
  let indices = Array.from(geometry.getIndex()!.array);
  const limit = maxEdge * maxEdge;

  const squaredLength = (a: number, b: number) =>
    (positions[a * 3]! - positions[b * 3]!) ** 2 +
    (positions[a * 3 + 1]! - positions[b * 3 + 1]!) ** 2 +
    (positions[a * 3 + 2]! - positions[b * 3 + 2]!) ** 2;
  const isLong = (a: number, b: number) => squaredLength(a, b) > limit;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const midpoints = new Map<string, number>();
    const mid = (a: number, b: number): number => {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      let index = midpoints.get(key);
      if (index === undefined) {
        index = positions.length / 3;
        for (let axis = 0; axis < 3; axis++) {
          positions.push((positions[a * 3 + axis]! + positions[b * 3 + axis]!) / 2);
        }
        midpoints.set(key, index);
      }
      return index;
    };

    const next: number[] = [];
    let split = false;
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t]!;
      const b = indices[t + 1]!;
      const c = indices[t + 2]!;
      const ab = isLong(a, b);
      const bc = isLong(b, c);
      const ca = isLong(c, a);
      const longCount = Number(ab) + Number(bc) + Number(ca);
      if (longCount === 0) {
        next.push(a, b, c);
        continue;
      }
      split = true;
      if (longCount === 3) {
        const [mab, mbc, mca] = [mid(a, b), mid(b, c), mid(c, a)];
        next.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      } else if (longCount === 1) {
        // Turn the triangle so its long edge is (p, q).
        const [p, q, r] = ab ? [a, b, c] : bc ? [b, c, a] : [c, a, b];
        const m = mid(p, q);
        next.push(p, m, r, m, q, r);
      } else {
        // Turn the triangle so its short edge is (r, p); the long ones are (p, q) and (q, r).
        const [p, q, r] = !ca ? [a, b, c] : !ab ? [b, c, a] : [c, a, b];
        const [mpq, mqr] = [mid(p, q), mid(q, r)];
        next.push(mpq, q, mqr, p, mpq, mqr, p, mqr, r);
      }
    }
    indices = next;
    if (!split) break;
  }

  const refined = new BufferGeometry();
  refined.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  refined.setIndex(indices);
  return refined;
}
