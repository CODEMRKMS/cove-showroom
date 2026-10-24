export type Rgb = [r: number, g: number, b: number];

/** "#rrggbb" to channels in 0..1. */
export function hexToRgb(hex: string): Rgb {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return [r, g, b];
}

export function rgbToHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((channel) =>
        Math.round(Math.min(Math.max(channel, 0), 1) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/**
 * One frame of exponential easing toward a target colour. `rate` is how fast (per second); the result
 * never passes the target, and the same maths gives the same feel at 30 and 144 frames per second.
 */
export function dampRgb(current: Rgb, target: Rgb, rate: number, dt: number): Rgb {
  const mix = 1 - Math.exp(-rate * dt);
  return current.map((channel, i) => channel + (target[i]! - channel) * mix) as Rgb;
}
