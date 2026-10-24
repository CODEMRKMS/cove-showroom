import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useVehicleSearch } from '../api/vehicles';
import { FilterBar } from '../components/FilterBar';
import { btnPrimary, btnQuiet } from '../components/styles';
import { VehicleCard } from '../components/VehicleCard';
import {
  DEFAULT_FILTERS,
  filtersToParams,
  hasActiveFilters,
  hasInvalidPriceRange,
  PAGE_SIZE,
  parseFilters,
  withFilterChange,
  type Filters,
} from '../lib/filters';
import { apiErrorMessage } from '../lib/messages';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { HoverTurnProvider } from '../studio/HoverTurn';

export function ShowroomPage() {
  useDocumentTitle('Showroom');
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const invalidRange = hasInvalidPriceRange(filters);
  const search = useVehicleSearch(filters, !invalidRange);

  // The URL is the single source of truth for filters: shareable, and the back button works.
  // Two fields can commit within the same tick, so changes build on the latest filters (a ref),
  // not on the params of the last render.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);
  const update = useCallback(
    (change: Partial<Filters>, options?: { replace?: boolean }) => {
      const next = withFilterChange(latest.current, change);
      latest.current = next;
      setParams(filtersToParams(next), { replace: options?.replace ?? false });
    },
    [setParams],
  );
  const clear = () => setParams(filtersToParams(DEFAULT_FILTERS));

  const total = search.data?.meta.total;
  const countText = total === undefined ? '' : `${total} ${total === 1 ? 'car' : 'cars'} found`;

  return (
    <HoverTurnProvider>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl">Showroom</h1>
          <p className="mt-1 text-graphite">Pick a car, choose a paint, and buy it from stock.</p>
        </div>

        <FilterBar
          filters={filters}
          onChange={update}
          onClear={clear}
          showClear={search.data?.meta.total !== 0}
        />

        <p aria-live="polite" className="font-semibold text-graphite">
          {invalidRange ? 'Fix the price range to see cars.' : countText}
        </p>

        {search.isError && !search.isPlaceholderData ? (
          <div role="alert" className="rounded-card border border-sold bg-white/70 p-5">
            <p className="font-semibold text-sold">{apiErrorMessage(search.error)}</p>
            <button type="button" className={`${btnPrimary} mt-3`} onClick={() => search.refetch()}>
              Try again
            </button>
          </div>
        ) : search.isPending && !invalidRange ? (
          <LoadingCards />
        ) : search.data && search.data.meta.total === 0 ? (
          <EmptyState filtered={hasActiveFilters(filters)} onClear={clear} />
        ) : search.data ? (
          <>
            <ul
              aria-label="Cars"
              aria-busy={search.isFetching}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {search.data.data.map((vehicle) => (
                <li key={vehicle.id} className="flex">
                  <VehicleCard vehicle={vehicle} />
                </li>
              ))}
            </ul>
            <Pagination
              page={search.data.meta.page}
              totalPages={search.data.meta.totalPages}
              onPage={(page) => update({ page })}
            />
          </>
        ) : null}
      </div>
    </HoverTurnProvider>
  );
}

function LoadingCards() {
  return (
    <div role="status" aria-label="Loading cars">
      <div aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(PAGE_SIZE, 6) }, (_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-card bg-floor/70" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="rounded-card bg-floor/60 p-8 text-center">
      <p className="font-display text-xl">
        {filtered ? 'No cars match these filters.' : 'The showroom is empty right now.'}
      </p>
      <p className="mt-2 text-graphite">
        {filtered
          ? 'Try a shorter search, a wider price range, or another category.'
          : 'An admin can add cars from the Admin page.'}
      </p>
      {filtered && (
        <button type="button" className={`${btnQuiet} mt-4`} onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-4">
      <button
        type="button"
        className={btnQuiet}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous page
      </button>
      <p className="font-semibold">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        className={btnQuiet}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next page
      </button>
    </nav>
  );
}
