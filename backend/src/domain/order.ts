/** A purchase as the API exposes it. Prices are integer minor units, snapshotted at purchase time. */
export type Order = {
  id: string;
  userId: string;
  vehicleId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** "Make Model" at the time of purchase, so history survives later edits or deletion. */
  vehicleLabel: string;
  createdAt: Date;
};
