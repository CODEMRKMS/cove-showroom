import type { PageRequest, PageResult } from '../domain/pagination.js';
import type { BodyStyle, Category, Vehicle } from '../domain/vehicle.js';

export type NewVehicle = {
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  year: number | null;
  bodyStyle: BodyStyle;
  colorOptions: string[];
  description: string | null;
};

/** Fields an update may change. A field left out is untouched; null clears an optional field. */
export type VehiclePatch = Partial<Omit<NewVehicle, 'quantity'>>;

/** Every field narrows the result; fields left out do not filter. Prices are minor units, both ends inclusive. */
export type VehicleFilter = {
  /** Each term must appear (case-insensitive) in the make or the model. */
  terms?: string[];
  /** Whole-value, case-insensitive matches. */
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  /** true: quantity above 0. false: sold out. */
  inStock?: boolean;
};

/** Persistence contract for vehicles. Services depend on this, not on Prisma. */
export interface VehicleRepository {
  /** Stores the vehicle and a CREATED inventory event for `actorId` in one transaction. */
  create(vehicle: NewVehicle, actorId: string): Promise<Vehicle>;
  /** Applies the patch and writes an UPDATED event in one transaction. Null when there is no live vehicle with this id. */
  update(id: string, patch: VehiclePatch, actorId: string): Promise<Vehicle | null>;
  /** A vehicle that is not soft-deleted, or null. */
  findById(id: string): Promise<Vehicle | null>;
  /** One page of vehicles that are not soft-deleted and match the filter, in a stable order. */
  findMany(request: PageRequest, filter?: VehicleFilter): Promise<PageResult<Vehicle>>;
}
