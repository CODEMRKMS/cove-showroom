/** Money is held as integer paise everywhere; only this file knows how it is shown or typed. */
const PAISE_PER_RUPEE = 100;

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

/** "₹12,50,000" for whole rupees, "₹123.45" when there are paise. */
export function formatINR(paise: number): string {
  const formatter = paise % PAISE_PER_RUPEE === 0 ? wholeRupees : withPaise;
  return formatter.format(paise / PAISE_PER_RUPEE);
}

// Digits with optional grouping commas, then at most two decimals.
const RUPEE_INPUT = /^\d[\d,]*(\.\d{1,2})?$/;

/** Reads what a person types ("12,50,000" or "99.5") as paise, or null if it is not an amount. */
export function rupeesToPaise(input: string): number | null {
  const text = input.trim();
  if (!RUPEE_INPUT.test(text)) return null;
  const [rupees = '', decimals = ''] = text.replaceAll(',', '').split('.');
  // Work in integers: parse the two parts separately so 0.29 never goes through floating point.
  return Number(rupees) * PAISE_PER_RUPEE + Number(decimals.padEnd(2, '0'));
}
