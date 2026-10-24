// Shapes the backend sends over HTTP (see backend/src/domain). Dates arrive as ISO strings and
// every price is an integer in paise.
export const CATEGORIES = [
  'HATCHBACK',
  'SEDAN',
  'SUV',
  'COUPE',
  'CONVERTIBLE',
  'TRUCK',
  'EV',
  'SPORTS',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type BodyStyle = Category;

export const SORT_OPTIONS = ['-createdAt', 'price', '-price', 'make'] as const;
export type VehicleSort = (typeof SORT_OPTIONS)[number];

export type Role = 'USER' | 'ADMIN';

export type User = { id: string; email: string; name: string; role: Role; createdAt: string };

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  year: number | null;
  bodyStyle: BodyStyle;
  colorOptions: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  userId: string;
  vehicleId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vehicleLabel: string;
  createdAt: string;
};

export type InventoryEventType = 'CREATED' | 'UPDATED' | 'PURCHASED' | 'RESTOCKED' | 'DELETED';

export type InventoryEvent = {
  id: string;
  type: InventoryEventType;
  delta: number;
  quantityAfter: number;
  createdAt: string;
  vehicle: { id: string; make: string; model: string };
  actor: { id: string; name: string };
};

export type Page<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
};

export type RefreshResponse = Omit<LoginResponse, 'user'>;
