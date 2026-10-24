import {
  DEFAULT_FILTERS,
  filtersToApiQuery,
  filtersToParams,
  hasActiveFilters,
  hasInvalidPriceRange,
  parseFilters,
  withFilterChange,
} from './filters';

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
  it('gives the defaults for an empty query string', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS);
    expect(DEFAULT_FILTERS).toEqual({
      q: '',
      category: null,
      minRupees: null,
      maxRupees: null,
      inStock: false,
      sort: '-createdAt',
      page: 1,
    });
  });

  it('reads every parameter', () => {
    expect(
      parse('q=swift&category=SUV&minPrice=500000&maxPrice=1500000&inStock=true&sort=price&page=3'),
    ).toEqual({
      q: 'swift',
      category: 'SUV',
      minRupees: 500_000,
      maxRupees: 1_500_000,
      inStock: true,
      sort: 'price',
      page: 3,
    });
  });

  it('ignores values it does not understand instead of failing', () => {
    expect(
      parse('category=BOAT&minPrice=abc&maxPrice=-4&inStock=maybe&sort=colour&page=0'),
    ).toEqual(DEFAULT_FILTERS);
    expect(parse('page=2.5').page).toBe(1);
    expect(parse('page=abc').page).toBe(1);
  });

  it('trims the search text', () => {
    expect(parse('q=%20%20civic%20').q).toBe('civic');
  });
});

describe('filtersToParams', () => {
  it('leaves defaults out so the URL stays short', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('writes only what differs from the defaults', () => {
    const params = filtersToParams({
      ...DEFAULT_FILTERS,
      q: 'civic',
      category: 'SEDAN',
      inStock: true,
      page: 2,
    });
    expect(params.toString()).toBe('q=civic&category=SEDAN&inStock=true&page=2');
  });

  it('round-trips through parseFilters', () => {
    const filters = {
      q: 'tata nexon',
      category: 'EV' as const,
      minRupees: 800_000,
      maxRupees: 2_000_000,
      inStock: true,
      sort: '-price' as const,
      page: 4,
    };
    expect(parse(filtersToParams(filters).toString())).toEqual(filters);
  });
});

describe('filtersToApiQuery', () => {
  it('always asks for a page and a sort, in the units the API uses', () => {
    expect(filtersToApiQuery(DEFAULT_FILTERS).toString()).toBe(
      'page=1&pageSize=12&sort=-createdAt',
    );
  });

  it('converts rupees to paise and passes the other filters through', () => {
    const query = filtersToApiQuery({
      ...DEFAULT_FILTERS,
      q: 'swift',
      category: 'HATCHBACK',
      minRupees: 500_000,
      maxRupees: 900_000,
      inStock: true,
      sort: 'price',
      page: 2,
    });
    expect(Object.fromEntries(query)).toEqual({
      q: 'swift',
      category: 'HATCHBACK',
      minPrice: '50000000',
      maxPrice: '90000000',
      inStock: 'true',
      sort: 'price',
      page: '2',
      pageSize: '12',
    });
  });

  it('does not send an empty search or an unticked in-stock box', () => {
    const query = filtersToApiQuery({ ...DEFAULT_FILTERS, q: '' });
    expect(query.has('q')).toBe(false);
    expect(query.has('inStock')).toBe(false);
  });
});

describe('withFilterChange', () => {
  it('goes back to page 1 when a filter changes', () => {
    const next = withFilterChange({ ...DEFAULT_FILTERS, page: 5 }, { category: 'SUV' });
    expect(next.page).toBe(1);
    expect(next.category).toBe('SUV');
  });

  it('keeps the page when only the page changes', () => {
    expect(withFilterChange(DEFAULT_FILTERS, { page: 3 }).page).toBe(3);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and for a different sort or page alone', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'price', page: 2 })).toBe(false);
  });

  it('is true when any narrowing filter is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, category: 'EV' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, minRupees: 1 })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, maxRupees: 1 })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, inStock: true })).toBe(true);
  });
});

describe('hasInvalidPriceRange', () => {
  it('is true only when the minimum is above the maximum', () => {
    expect(hasInvalidPriceRange({ ...DEFAULT_FILTERS, minRupees: 9, maxRupees: 5 })).toBe(true);
    expect(hasInvalidPriceRange({ ...DEFAULT_FILTERS, minRupees: 5, maxRupees: 5 })).toBe(false);
    expect(hasInvalidPriceRange({ ...DEFAULT_FILTERS, minRupees: 5 })).toBe(false);
  });
});
