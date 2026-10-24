export const SORT_OPTIONS = ['price', '-price', 'make', '-createdAt'] as const;

export type VehicleSort = (typeof SORT_OPTIONS)[number];

export const MAX_PAGE_SIZE = 50;

/** Which page to read. Pages start at 1. */
export type PageParams = { page: number; pageSize: number };

export type PageRequest = PageParams & { sort: VehicleSort };

/** One page of results plus the total number of matches across all pages. */
export type PageResult<T> = { items: T[]; total: number };

export type Paginated<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

/** Wraps one page of results with the meta block every list endpoint returns. */
export function paginate<T>(
  { items, total }: PageResult<T>,
  { page, pageSize }: PageParams,
): Paginated<T> {
  return { data: items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
