import { CATEGORIES, type BodyStyle } from '../api/types';
import { buildCarSpec, describeColour } from './carSpec';

const car = (overrides: Partial<Parameters<typeof buildCarSpec>[0]> = {}) => ({
  make: 'Honda',
  model: 'City',
  year: 2025 as number | null,
  bodyStyle: 'SEDAN' as BodyStyle,
  colorOptions: ['#F2F2F2', '#1B1B1B'],
  ...overrides,
});

const specFor = (bodyStyle: BodyStyle) => buildCarSpec(car({ bodyStyle }));

describe('buildCarSpec paint', () => {
  it('uses the first colour option when none is chosen', () => {
    expect(buildCarSpec(car()).paint).toBe('#f2f2f2');
  });

  it('uses the chosen paint, lower-cased', () => {
    expect(buildCarSpec(car(), '#1B1B1B').paint).toBe('#1b1b1b');
  });

  it('falls back to a neutral grey when there are no options or the value is not a hex colour', () => {
    expect(buildCarSpec(car({ colorOptions: [] })).paint).toBe('#8f887c');
    expect(buildCarSpec(car(), 'blue').paint).toBe('#f2f2f2');
    expect(buildCarSpec(car({ colorOptions: ['nope'] })).paint).toBe('#8f887c');
  });
});

describe('buildCarSpec silhouettes', () => {
  it('draws every body style differently', () => {
    const shapes = new Set(CATEGORIES.map((style) => JSON.stringify(specFor(style).profile)));
    expect(shapes.size).toBe(CATEGORIES.length);
  });

  it('orders roof heights the way the real cars sit: sports lowest, SUV and truck tallest', () => {
    const roof = (style: BodyStyle) => specFor(style).profile.roofHeight;
    expect(roof('SPORTS')).toBeLessThan(roof('COUPE'));
    expect(roof('COUPE')).toBeLessThan(roof('SEDAN'));
    expect(roof('SEDAN')).toBeLessThan(roof('HATCHBACK'));
    expect(roof('HATCHBACK')).toBeLessThan(roof('SUV'));
  });

  it('gives only the convertible an open top, only the truck a bed, and the EV no grille', () => {
    for (const style of CATEGORIES) {
      const spec = specFor(style);
      expect(spec.roof === 'open', style).toBe(style === 'CONVERTIBLE');
      expect(spec.bed, style).toBe(style === 'TRUCK');
      expect(spec.grille, style).toBe(style !== 'EV');
    }
  });

  it('keeps the wheels inside the body for every style', () => {
    for (const style of CATEGORIES) {
      const { profile, wheels } = specFor(style);
      expect(wheels.rearX - wheels.radius, style).toBeGreaterThan(profile.tailX);
      expect(wheels.frontX + wheels.radius, style).toBeLessThan(profile.noseX);
    }
  });
});

describe('buildCarSpec description', () => {
  it('describes the car for assistive technology: year, name, body style and colour', () => {
    expect(buildCarSpec(car()).description).toBe('2025 Honda City, sedan, white');
    expect(buildCarSpec(car(), '#1B1B1B').description).toBe('2025 Honda City, sedan, black');
  });

  it('leaves the year out when there is none', () => {
    expect(buildCarSpec(car({ year: null, bodyStyle: 'EV' })).description).toBe(
      'Honda City, EV, white',
    );
  });

  it('writes body styles in plain words', () => {
    expect(specFor('SUV').description).toContain('SUV');
    expect(specFor('HATCHBACK').description).toContain('hatchback');
  });
});

describe('describeColour', () => {
  it.each([
    ['#FFFFFF', 'white'],
    ['#F2F2F2', 'white'],
    ['#1B1B1B', 'black'],
    ['#7A8B99', 'grey'],
    ['#C0392B', 'red'],
    ['#B42318', 'red'],
    ['#1F5FBF', 'blue'],
    ['#E6B422', 'yellow'],
    ['#2E7D32', 'green'],
    ['#E87722', 'orange'],
    ['#6B2FA3', 'purple'],
  ])('names %s as %s', (hex, name) => {
    expect(describeColour(hex)).toBe(name);
  });

  it('calls an unreadable value "custom"', () => {
    expect(describeColour('nope')).toBe('custom');
  });
});
