import { LOW_STOCK_THRESHOLD, stockState } from './stock';

describe('stockState', () => {
  it('is sold out only at zero', () => {
    expect(stockState(0)).toBe('sold-out');
  });

  it('is low for 1 up to the threshold, and the threshold is 3', () => {
    expect(LOW_STOCK_THRESHOLD).toBe(3);
    expect(stockState(1)).toBe('low');
    expect(stockState(3)).toBe('low');
  });

  it('is in stock above the threshold', () => {
    expect(stockState(4)).toBe('in-stock');
    expect(stockState(250)).toBe('in-stock');
  });
});
