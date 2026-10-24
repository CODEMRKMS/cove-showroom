import type { Order } from '../domain/order.js';
import type { Vehicle } from '../domain/vehicle.js';

export type PurchaseRequest = { vehicleId: string; userId: string; quantity: number };

export type PurchaseResult = { vehicle: Vehicle; order: Order };

/** Persistence contract for stock changes. Each method is one atomic unit of work. */
export interface InventoryRepository {
  /**
   * Decrements stock, stores the order and writes a PURCHASED event, or does none of it.
   * @throws VehicleNotFoundError when there is no live vehicle with this id.
   * @throws OutOfStockError when fewer than `quantity` units remain.
   */
  purchase(request: PurchaseRequest): Promise<PurchaseResult>;
}
