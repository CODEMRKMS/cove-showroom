import type { Category, VehicleSort } from '../api/types';

export const CATEGORY_LABELS: Record<Category, string> = {
  HATCHBACK: 'Hatchback',
  SEDAN: 'Sedan',
  SUV: 'SUV',
  COUPE: 'Coupe',
  CONVERTIBLE: 'Convertible',
  TRUCK: 'Truck',
  EV: 'EV',
  SPORTS: 'Sports',
};

export const SORT_LABELS: Record<VehicleSort, string> = {
  '-createdAt': 'Newest',
  price: 'Price: low to high',
  '-price': 'Price: high to low',
  make: 'Make: A to Z',
};
