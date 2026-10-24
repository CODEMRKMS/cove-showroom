export type InventoryEventType = 'CREATED' | 'UPDATED' | 'PURCHASED' | 'RESTOCKED' | 'DELETED';

/**
 * One ledger entry as the admin feed shows it. People appear by id and display name only, never by
 * email, and the vehicle by name, so the entry stays readable after the vehicle is soft-deleted.
 */
export type InventoryEvent = {
  id: string;
  type: InventoryEventType;
  delta: number;
  quantityAfter: number;
  createdAt: Date;
  vehicle: { id: string; make: string; model: string };
  actor: { id: string; name: string };
};
