import { CATEGORIES, SORT_OPTIONS, type Category, type VehicleSort } from '../api/types';

/** Everything the showroom lets a visitor narrow by. Prices are whole rupees, as typed and as in the URL. */
export type Filters = {
  q: string;
  category: Category | null;
  minRupees: number | null;
  maxRupees: number | null;
  inStock: boolean;
  sort: VehicleSort;
  page: number;
};

export const PAGE_SIZE = 12;
const PAISE_PER_RUPEE = 100;

export const DEFAULT_FILTERS: Filters = {
  q: '',
  category: null,
  minRupees: null,
  maxRupees: null,
  inStock: false,
  sort: '-createdAt',
  page: 1,
};

const isCategory = (value: string | null): value is Category =>
  CATEGORIES.some((category) => category === value);
const isSort = (value: string | null): value is VehicleSort =>
  SORT_OPTIONS.some((sort) => sort === value);

/** A whole number >= min, or null. Anything else in the URL is treated as absent. */
function wholeNumber(value: string | null, min: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min ? number : null;
}

/** Reads the URL. A link edited by hand, or an old one, falls back to defaults rather than breaking the page. */
export function parseFilters(params: URLSearchParams): Filters {
  const category = params.get('category');
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').trim(),
    category: isCategory(category) ? category : null,
    minRupees: wholeNumber(params.get('minPrice'), 0),
    maxRupees: wholeNumber(params.get('maxPrice'), 0),
    inStock: params.get('inStock') === 'true',
    sort: isSort(sort) ? sort : DEFAULT_FILTERS.sort,
    page: wholeNumber(params.get('page'), 1) ?? 1,
  };
}

/** Writes the URL. Values equal to the defaults are left out. */
export function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.minRupees !== null) params.set('minPrice', String(filters.minRupees));
  if (filters.maxRupees !== null) params.set('maxPrice', String(filters.maxRupees));
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params;
}

/** The query string for GET /api/vehicles/search: prices in paise, paging and sort always present. */
export function filtersToApiQuery(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.minRupees !== null) {
    params.set('minPrice', String(filters.minRupees * PAISE_PER_RUPEE));
  }
  if (filters.maxRupees !== null) {
    params.set('maxPrice', String(filters.maxRupees * PAISE_PER_RUPEE));
  }
  if (filters.inStock) params.set('inStock', 'true');
  params.set('page', String(filters.page));
  params.set('pageSize', String(PAGE_SIZE));
  params.set('sort', filters.sort);
  return params;
}

/** Applies a change. Any change other than the page itself starts again from page 1. */
export function withFilterChange(filters: Filters, change: Partial<Filters>): Filters {
  const next = { ...filters, ...change };
  return 'page' in change ? next : { ...next, page: 1 };
}

/** True when something narrows the result list. Sort and page do not count. */
export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.q !== '' ||
    filters.category !== null ||
    filters.minRupees !== null ||
    filters.maxRupees !== null ||
    filters.inStock
  );
}

/** The API rejects minPrice > maxPrice, so the page checks first and explains. */
export function hasInvalidPriceRange(filters: Filters): boolean {
  return (
    filters.minRupees !== null &&
    filters.maxRupees !== null &&
    filters.minRupees > filters.maxRupees
  );
}
