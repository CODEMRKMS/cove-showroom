import type { InventoryRepository, PurchaseResult } from '../repositories/inventory.repository.js';

export class InventoryService {
  constructor(private readonly inventory: InventoryRepository) {}

  /** The repository does the stock check inside the same statement that takes the stock. */
  purchase(vehicleId: string, userId: string, quantity: number): Promise<PurchaseResult> {
    return this.inventory.purchase({ vehicleId, userId, quantity });
  }
}
