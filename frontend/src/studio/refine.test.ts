import { BufferAttribute, BufferGeometry } from 'three';
import { refineLongEdges } from './refine';

function meshOf(positions: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  return geometry;
}

// A unit square in the xy plane, as two triangles sharing the diagonal.
const square = () => meshOf([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);

function edgesOf(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  const point = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)] as const;
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let t = 0; t < index.count; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = index.getX(t + k);
      const b = index.getX(t + ((k + 1) % 3));
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const entry = edges.get(key) ?? { a, b, count: 0 };
      entry.count += 1;
      edges.set(key, entry);
    }
  }
  const length = (a: number, b: number) => Math.hypot(...point(a).map((v, i) => v - point(b)[i]!));
  return { edges: [...edges.values()], point, length };
}

describe('refineLongEdges', () => {
  it('splits until no edge is longer than the limit', () => {
    const refined = refineLongEdges(square(), 0.3);
    const { edges, length } = edgesOf(refined);
    expect(Math.max(...edges.map((e) => length(e.a, e.b)))).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(refined.getIndex()!.count / 3).toBeGreaterThan(2);
  });

  it('keeps the surface the same: total area and bounds do not change', () => {
    const refined = refineLongEdges(square(), 0.3);
    const position = refined.getAttribute('position');
    const index = refined.getIndex()!;
    let area = 0;
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => index.getX(t + k));
      const ux = position.getX(b!) - position.getX(a!);
      const uy = position.getY(b!) - position.getY(a!);
      const vx = position.getX(c!) - position.getX(a!);
      const vy = position.getY(c!) - position.getY(a!);
      area += Math.abs(ux * vy - uy * vx) / 2;
    }
    expect(area).toBeCloseTo(1, 6);
    refined.computeBoundingBox();
    expect(refined.boundingBox!.max.x).toBeCloseTo(1);
    expect(refined.boundingBox!.min.y).toBeCloseTo(0);
  });

  it("leaves no crack: no vertex sits in the middle of another triangle's edge", () => {
    const refined = refineLongEdges(square(), 0.3);
    const { edges, point } = edgesOf(refined);
    const position = refined.getAttribute('position');
    for (let v = 0; v < position.count; v++) {
      const [px, py] = point(v);
      for (const { a, b } of edges) {
        if (a === v || b === v) continue;
        const [ax, ay] = point(a);
        const [bx, by] = point(b);
        const along =
          ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
        const distance = Math.hypot(ax + along * (bx - ax) - px, ay + along * (by - ay) - py);
        const inside = along > 1e-6 && along < 1 - 1e-6;
        expect(inside && distance < 1e-6, `vertex ${v} lies on edge ${a}-${b}`).toBe(false);
      }
    }
  });

  it('shares every inner edge between exactly two triangles', () => {
    const { edges } = edgesOf(refineLongEdges(square(), 0.3));
    expect(edges.every((edge) => edge.count === 1 || edge.count === 2)).toBe(true);
    expect(edges.filter((edge) => edge.count === 1)).toHaveLength(16);
  });

  it('does nothing to a mesh that is already fine', () => {
    const refined = refineLongEdges(square(), 5);
    expect(refined.getIndex()!.count).toBe(6);
    expect(refined.getAttribute('position').count).toBe(4);
  });
});
