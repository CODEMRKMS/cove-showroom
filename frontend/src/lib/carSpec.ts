import type { BodyStyle } from '../api/types';

/**
 * Everything the SVG illustration needs to draw one car. Lengths are in SVG user units in a 400 wide
 * view box with the floor at 0 and heights measured upward; x grows toward the front of the car.
 */
export type CarSpec = {
  bodyStyle: BodyStyle;
  paint: string;
  profile: Profile;
  wheels: { radius: number; rearX: number; frontX: number };
  roof: 'fixed' | 'open';
  bed: boolean;
  grille: boolean;
  description: string;
};

export type Profile = {
  tailX: number;
  noseX: number;
  hoodHeight: number;
  beltHeight: number;
  trunkHeight: number;
  roofHeight: number;
  windscreenBaseX: number;
  windscreenTopX: number;
  rearGlassTopX: number;
  rearGlassBaseX: number;
};

type Template = { profile: Profile; wheels: CarSpec['wheels'] };

// One row per body style. Heights run: sports < coupe < sedan < hatchback < SUV / truck.
const TEMPLATES: Record<BodyStyle, Template> = {
  HATCHBACK: {
    profile: {
      tailX: 44,
      noseX: 360,
      hoodHeight: 64,
      beltHeight: 76,
      trunkHeight: 84,
      roofHeight: 114,
      windscreenBaseX: 262,
      windscreenTopX: 222,
      rearGlassTopX: 96,
      rearGlassBaseX: 50,
    },
    wheels: { radius: 30, rearX: 104, frontX: 296 },
  },
  SEDAN: {
    profile: {
      tailX: 36,
      noseX: 368,
      hoodHeight: 68,
      beltHeight: 78,
      trunkHeight: 84,
      roofHeight: 108,
      windscreenBaseX: 268,
      windscreenTopX: 226,
      rearGlassTopX: 130,
      rearGlassBaseX: 100,
    },
    wheels: { radius: 30, rearX: 102, frontX: 302 },
  },
  SUV: {
    profile: {
      tailX: 40,
      noseX: 364,
      hoodHeight: 88,
      beltHeight: 94,
      trunkHeight: 100,
      roofHeight: 128,
      windscreenBaseX: 276,
      windscreenTopX: 246,
      rearGlassTopX: 80,
      rearGlassBaseX: 46,
    },
    wheels: { radius: 34, rearX: 104, frontX: 300 },
  },
  COUPE: {
    profile: {
      tailX: 34,
      noseX: 370,
      hoodHeight: 64,
      beltHeight: 74,
      trunkHeight: 80,
      roofHeight: 96,
      windscreenBaseX: 262,
      windscreenTopX: 214,
      rearGlassTopX: 124,
      rearGlassBaseX: 62,
    },
    wheels: { radius: 31, rearX: 98, frontX: 304 },
  },
  CONVERTIBLE: {
    profile: {
      tailX: 34,
      noseX: 370,
      hoodHeight: 62,
      beltHeight: 72,
      trunkHeight: 76,
      roofHeight: 90,
      windscreenBaseX: 256,
      windscreenTopX: 236,
      rearGlassTopX: 120,
      rearGlassBaseX: 120,
    },
    wheels: { radius: 30, rearX: 98, frontX: 304 },
  },
  TRUCK: {
    profile: {
      tailX: 30,
      noseX: 372,
      hoodHeight: 92,
      beltHeight: 98,
      trunkHeight: 98,
      roofHeight: 124,
      windscreenBaseX: 280,
      windscreenTopX: 252,
      rearGlassTopX: 198,
      rearGlassBaseX: 196,
    },
    wheels: { radius: 36, rearX: 96, frontX: 306 },
  },
  EV: {
    profile: {
      tailX: 40,
      noseX: 364,
      hoodHeight: 62,
      beltHeight: 74,
      trunkHeight: 80,
      roofHeight: 104,
      windscreenBaseX: 266,
      windscreenTopX: 214,
      rearGlassTopX: 108,
      rearGlassBaseX: 54,
    },
    wheels: { radius: 31, rearX: 104, frontX: 298 },
  },
  SPORTS: {
    profile: {
      tailX: 30,
      noseX: 374,
      hoodHeight: 54,
      beltHeight: 64,
      trunkHeight: 70,
      roofHeight: 88,
      windscreenBaseX: 250,
      windscreenTopX: 206,
      rearGlassTopX: 128,
      rearGlassBaseX: 60,
    },
    wheels: { radius: 29, rearX: 96, frontX: 306 },
  },
};

const NEUTRAL_PAINT = '#8f887c';
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const isHex = (value: string | undefined): value is string => !!value && HEX_COLOUR.test(value);

export type CarSpecInput = {
  make: string;
  model: string;
  year: number | null;
  bodyStyle: BodyStyle;
  colorOptions: string[];
};

// "SUV" and "EV" are acronyms; the other styles read better in lower case.
const bodyStyleWords = (style: BodyStyle): string =>
  style === 'SUV' || style === 'EV' ? style : style.toLowerCase();

/** Turns a vehicle (and optionally the paint a visitor picked) into drawing instructions. */
export function buildCarSpec(car: CarSpecInput, chosenPaint?: string): CarSpec {
  const { profile, wheels } = TEMPLATES[car.bodyStyle];
  const paint = (
    isHex(chosenPaint) ? chosenPaint : (car.colorOptions.find(isHex) ?? NEUTRAL_PAINT)
  ).toLowerCase();
  const name = `${car.year ? `${car.year} ` : ''}${car.make} ${car.model}`;
  return {
    bodyStyle: car.bodyStyle,
    paint,
    profile,
    wheels,
    roof: car.bodyStyle === 'CONVERTIBLE' ? 'open' : 'fixed',
    bed: car.bodyStyle === 'TRUCK',
    grille: car.bodyStyle !== 'EV',
    description: `${name}, ${bodyStyleWords(car.bodyStyle)}, ${describeColour(paint)}`,
  };
}

/** A plain colour word for a hex paint, for alt text. Based on lightness, saturation and hue. */
export function describeColour(hex: string): string {
  if (!isHex(hex)) return 'custom';
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (lightness >= 0.85) return 'white';
  if (lightness <= 0.12) return 'black';
  if (saturation < 0.15) return 'grey';

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 40) return 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 200) return 'teal';
  if (hue < 255) return 'blue';
  if (hue < 320) return 'purple';
  return 'pink';
}
