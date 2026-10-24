/** The "page follows the paint" idea needs every paint to be safe to use as text and UI colour. */
export const FALLBACK_ACCENT = '#1d4ed8'; // Lacquer Blue
const STUDIO_INK = '#1c2127';
const WHITE = '#ffffff';

// The two surfaces an accent sits on: the page wall and the card floor (docs/design.md).
const SURFACES = ['#efeae2', '#e2dbd0'] as const;
const MIN_TEXT_CONTRAST = 4.5;
// Beyond this much darkening the paint no longer looks like itself, so use the fallback instead.
const MAX_DARKEN = 0.5;
const DARKEN_STEP = 0.05;

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) return short.slice(1, 4).map((digit) => parseInt(digit + digit, 16)) as Rgb;
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return long ? (long.slice(1, 4).map((pair) => parseInt(pair, 16)) as Rgb) : null;
}

const toHex = (rgb: Rgb): string =>
  '#' + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');

function luminance([r, g, b]: Rgb): number {
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2 contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);
  if (!rgbA || !rgbB) throw new Error(`Not a hex colour: ${!rgbA ? a : b}`);
  const [light, dark] = [luminance(rgbA), luminance(rgbB)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

const readableOnSurfaces = (colour: string) =>
  SURFACES.every((surface) => contrastRatio(colour, surface) >= MIN_TEXT_CONTRAST);

function inkFor(accent: string): string {
  return contrastRatio(WHITE, accent) >= contrastRatio(STUDIO_INK, accent) ? WHITE : STUDIO_INK;
}

export type Accent = { accent: string; ink: string };

const fallback = (): Accent => ({ accent: FALLBACK_ACCENT, ink: inkFor(FALLBACK_ACCENT) });

/** The accent for a paint: the paint itself if readable, a darker shade of it if not, else Lacquer Blue. */
export function pickAccent(paint: string | undefined): Accent {
  // Only full six-digit hex paints are accepted; the API already guarantees that shape.
  if (!paint || paint.length !== 7) return fallback();
  const rgb = toRgb(paint);
  if (!rgb) return fallback();

  for (let darken = 0; darken <= MAX_DARKEN + 1e-9; darken += DARKEN_STEP) {
    const candidate = toHex(rgb.map((channel) => channel * (1 - darken)) as Rgb);
    if (readableOnSurfaces(candidate)) return { accent: candidate, ink: inkFor(candidate) };
  }
  return fallback();
}
