/** A "Low stock" badge is shown at this many units or fewer, and only because the real quantity says so. */
export const LOW_STOCK_THRESHOLD = 3;

export type StockState = 'sold-out' | 'low' | 'in-stock';

export function stockState(quantity: number): StockState {
  if (quantity <= 0) return 'sold-out';
  return quantity <= LOW_STOCK_THRESHOLD ? 'low' : 'in-stock';
}
