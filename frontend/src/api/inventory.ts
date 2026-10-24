import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import type { ApiClient } from './client';
import type { Category, InventoryEvent, Order, Page, Vehicle } from './types';

const ALL_PAGE_SIZE = 50; // the API's maximum
const MAX_PAGES = 20; // 1,000 cars; a guard against an endless loop, far above this demo's catalogue

/** Every car, read page by page, for the admin table and its summary tiles. */
async function fetchAllVehicles(api: ApiClient): Promise<Vehicle[]> {
  const all: Vehicle[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await api.request<Page<Vehicle>>('/api/vehicles/search', {
      query: new URLSearchParams({
        page: String(page),
        pageSize: String(ALL_PAGE_SIZE),
        sort: 'make',
      }),
    });
    all.push(...result.data);
    if (page >= result.meta.totalPages) break;
  }
  return all;
}

export function useAllVehicles() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['inventory', 'all'], queryFn: () => fetchAllVehicles(api) });
}

export function useInventoryEvents() {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => (await api.request<{ data: InventoryEvent[] }>('/api/admin/events')).data,
  });
}

export function useMyOrders() {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.request<Page<Order>>('/api/orders/mine')).data,
  });
}

/** Fields the admin form sends. Prices are paise. Quantity is only sent when creating. */
export type VehicleInput = {
  make: string;
  model: string;
  category: Category;
  bodyStyle: Category;
  price: number;
  quantity?: number;
  year?: number | null;
  colorOptions: string[];
  description?: string | null;
};

/** After any admin change, everything derived from the inventory is read again. */
function useRefreshInventory() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
}

export function useCreateVehicle() {
  const { api } = useAuth();
  const refresh = useRefreshInventory();
  return useMutation({
    mutationFn: (input: VehicleInput) =>
      api.request<Vehicle>('/api/vehicles', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateVehicle(id: string) {
  const { api } = useAuth();
  const refresh = useRefreshInventory();
  return useMutation({
    mutationFn: (input: VehicleInput) =>
      api.request<Vehicle>(`/api/vehicles/${id}`, { method: 'PUT', body: input }),
    onSuccess: refresh,
  });
}

export function useRestockVehicle(id: string) {
  const { api } = useAuth();
  const refresh = useRefreshInventory();
  return useMutation({
    mutationFn: (quantity: number) =>
      api.request<Vehicle>(`/api/vehicles/${id}/restock`, { method: 'POST', body: { quantity } }),
    onSuccess: refresh,
  });
}

export function useDeleteVehicle(id: string) {
  const { api } = useAuth();
  const refresh = useRefreshInventory();
  return useMutation({
    mutationFn: () => api.request<void>(`/api/vehicles/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}
