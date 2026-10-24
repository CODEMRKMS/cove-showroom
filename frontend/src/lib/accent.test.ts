import { contrastRatio, FALLBACK_ACCENT, pickAccent } from './accent';

const WALL = '#EFEAE2';
const FLOOR = '#E2DBD0';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#1D4ED8', '#1D4ED8')).toBeCloseTo(1, 5);
  });

  it('does not depend on the order of the arguments', () => {
    expect(contrastRatio('#1D4ED8', WALL)).toBeCloseTo(contrastRatio(WALL, '#1D4ED8'), 10);
  });

  it('matches the ratios recorded in docs/design.md', () => {
    expect(contrastRatio('#1C2127', WALL)).toBeCloseTo(13.53, 1);
    expect(contrastRatio('#1D4ED8', WALL)).toBeCloseTo(5.6, 1);
  });

  it('accepts three-digit and lower-case hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });
});

describe('pickAccent', () => {
  it('keeps a paint that is already dark enough', () => {
    expect(pickAccent('#1B1B1B').accent).toBe('#1b1b1b');
    expect(pickAccent('#1F5FBF').accent).toBe('#1f5fbf');
  });

  it('darkens a paint that is too light until text on both surfaces reaches 4.5:1', () => {
    const { accent } = pickAccent('#C0392B');
    expect(contrastRatio(accent, WALL)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accent, FLOOR)).toBeGreaterThanOrEqual(4.5);
  });

  it('guarantees 4.5:1 on both surfaces for every colour it returns', () => {
    for (const paint of ['#E6B422', '#8FA3B3', '#7A8B99', '#B42318', '#2F4F4F', '#F2F2F2', '#FFFF00']) {
      const { accent } = pickAccent(paint);
      expect(contrastRatio(accent, WALL), paint).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accent, FLOOR), paint).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to Lacquer Blue for a paint that would have to be darkened out of recognition', () => {
    expect(FALLBACK_ACCENT).toBe('#1d4ed8');
    expect(pickAccent('#FFFFFF').accent).toBe(FALLBACK_ACCENT);
    expect(pickAccent('#F2F2F2').accent).toBe(FALLBACK_ACCENT);
  });

  it('falls back for anything that is not a six-digit hex colour', () => {
    expect(pickAccent('red').accent).toBe(FALLBACK_ACCENT);
    expect(pickAccent('').accent).toBe(FALLBACK_ACCENT);
    expect(pickAccent(undefined).accent).toBe(FALLBACK_ACCENT);
  });

  it('chooses white or Studio Ink text so that text on the accent reaches 4.5:1', () => {
    for (const paint of ['#1B1B1B', '#1F5FBF', '#E6B422', '#FFFFFF']) {
      const { accent, ink } = pickAccent(paint);
      expect(['#ffffff', '#1c2127']).toContain(ink);
      expect(contrastRatio(ink, accent), paint).toBeGreaterThanOrEqual(4.5);
    }
  });
});
