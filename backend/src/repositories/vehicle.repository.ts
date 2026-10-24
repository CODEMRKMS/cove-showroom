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

/** Persistence contract for vehicles. Services depend on this, not on Prisma. */
export interface VehicleRepository {
  /** Stores the vehicle and a CREATED inventory event for `actorId` in one transaction. */
  create(vehicle: NewVehicle, actorId: string): Promise<Vehicle>;
}
