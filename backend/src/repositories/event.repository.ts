import type { InventoryEvent } from '../domain/inventory-event.js';

/** Read access to the append-only inventory ledger. Events are written by the repositories that change stock. */
export interface EventRepository {
  /** The newest `limit` events, newest first. Includes events for soft-deleted vehicles. */
  findRecent(limit: number): Promise<InventoryEvent[]>;
}
