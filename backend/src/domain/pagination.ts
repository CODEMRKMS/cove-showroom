export const SORT_OPTIONS = ['price', '-price', 'make', '-createdAt'] as const;

export type VehicleSort = (typeof SORT_OPTIONS)[number];

export const MAX_PAGE_SIZE = 50;

export type PageRequest = { page: number; pageSize: number; sort: VehicleSort };

/** One page of results plus the total number of matches across all pages. */
export type PageResult<T> = { items: T[]; total: number };

export type Paginated<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
