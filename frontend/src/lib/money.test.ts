import { formatINR, rupeesToPaise } from './money';

describe('formatINR', () => {
  it('formats whole rupees with Indian digit grouping and no decimals', () => {
    expect(formatINR(125_000_000)).toBe('₹12,50,000');
  });

  it('shows two decimals only when there are paise', () => {
    expect(formatINR(12_345)).toBe('₹123.45');
    expect(formatINR(50)).toBe('₹0.50');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });

  it('groups lakhs and crores', () => {
    expect(formatINR(65_000_000)).toBe('₹6,50,000');
    expect(formatINR(10_000_000_000)).toBe('₹10,00,00,000');
  });
});

describe('rupeesToPaise', () => {
  it('converts whole rupees', () => {
    expect(rupeesToPaise('650000')).toBe(65_000_000);
  });

  it('accepts digit grouping commas and surrounding spaces', () => {
    expect(rupeesToPaise(' 12,50,000 ')).toBe(125_000_000);
  });

  it('accepts up to two decimal places without floating-point drift', () => {
    expect(rupeesToPaise('99.5')).toBe(9_950);
    expect(rupeesToPaise('0.29')).toBe(29);
    expect(rupeesToPaise('1.10')).toBe(110);
  });

  it.each(['', '   ', 'abc', '-5', '1.234', '1e5', '12..5', '₹500'])('rejects %j', (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });
});
