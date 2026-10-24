/** A small seeded random generator (mulberry32), so the flake texture is identical on every load. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLAKE_SHARE = 0.12;

/**
 * RGBA bytes for a square tangent-space normal map that makes metallic paint sparkle: a flat surface
 * (128, 128, 255) with a scattering of tilted micro-flakes and faint grain. Generated in code, no image file.
 */
export function flakeNormalData(size: number, seed: number): Uint8Array {
  const random = seeded(seed);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let dx = (random() - 0.5) * 4;
    let dy = (random() - 0.5) * 4;
    if (random() < FLAKE_SHARE) {
      const strength = 20 + random() * 30;
      const angle = random() * Math.PI * 2;
      dx = Math.cos(angle) * strength;
      dy = Math.sin(angle) * strength;
    }
    data[i * 4] = Math.round(128 + dx);
    data[i * 4 + 1] = Math.round(128 + dy);
    data[i * 4 + 2] = Math.round(255 - (Math.abs(dx) + Math.abs(dy)) / 2);
    data[i * 4 + 3] = 255;
  }
  return data;
}
