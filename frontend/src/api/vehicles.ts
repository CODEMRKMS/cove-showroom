import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { filtersToApiQuery, type Filters } from '../lib/filters';
import type { Order, Page, Vehicle } from './types';

const VEHICLES = ['vehicles'] as const;
const VEHICLE = ['vehicle'] as const;

/** One page of search results. Disabled while the filters are not valid (see hasInvalidPriceRange). */
export function useVehicleSearch(filters: Filters, enabled = true) {
  const { api } = useAuth();
  const query = filtersToApiQuery(filters);
  return useQuery({
    queryKey: [...VEHICLES, 'search', query.toString()],
    queryFn: () => api.request<Page<Vehicle>>('/api/vehicles/search', { query }),
    enabled,
    // Keep showing the old page while the next one loads, so filtering never flashes empty.
    placeholderData: keepPreviousData,
  });
}

/** One car by id, for the detail page. A 404 surfaces as an ApiError the page turns into "Car not found". */
export function useVehicle(id: string | undefined) {
  const { api } = useAuth();
  return useQuery({
    queryKey: [...VEHICLE, id],
    queryFn: () => api.request<Vehicle>(`/api/vehicles/${id}`),
    enabled: !!id,
  });
}

type Snapshot = [readonly unknown[], Page<Vehicle> | undefined][];

/**
 * Buys one unit. The card's stock drops immediately (optimistic); if the server refuses, for example
 * with a 409 because someone else bought the last unit, the previous numbers are restored and the
 * list is re-read so the card shows the real stock.
 */
export function useBuyVehicle() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicle: Vehicle) =>
      api.request<{ vehicle: Vehicle; order: Order }>(`/api/vehicles/${vehicle.id}/purchase`, {
        method: 'POST',
        body: { quantity: 1 },
      }),
    onMutate: async (vehicle) => {
      await queryClient.cancelQueries({ queryKey: VEHICLES });
      await queryClient.cancelQueries({ queryKey: [...VEHICLE, vehicle.id] });
      const single = queryClient.getQueryData<Vehicle>([...VEHICLE, vehicle.id]);
      queryClient.setQueryData<Vehicle>(
        [...VEHICLE, vehicle.id],
        (current) => current && { ...current, quantity: Math.max(0, current.quantity - 1) },
      );
      const snapshot: Snapshot = queryClient.getQueriesData<Page<Vehicle>>({ queryKey: VEHICLES });
      queryClient.setQueriesData<Page<Vehicle>>(
        { queryKey: VEHICLES },
        (page) =>
          page && {
            ...page,
            data: page.data.map((v) =>
              v.id === vehicle.id ? { ...v, quantity: Math.max(0, v.quantity - 1) } : v,
            ),
          },
      );
      return { snapshot, single, id: vehicle.id };
    },
    onError: (_error, _vehicle, context) => {
      context?.snapshot.forEach(([key, page]) => queryClient.setQueryData(key, page));
      if (context?.single) queryClient.setQueryData([...VEHICLE, context.id], context.single);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES });
      void queryClient.invalidateQueries({ queryKey: VEHICLE });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
