import type { Order } from '../domain/order.js';
import type { Vehicle } from '../domain/vehicle.js';
import type { Order as OrderRow, Vehicle as VehicleRow } from '../generated/prisma/client.js';

// Prices are BigInt in the database and number everywhere else. That is safe
// because the API caps them far below 2^53.
export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    category: row.category,
    price: Number(row.price),
    quantity: row.quantity,
    year: row.year,
    bodyStyle: row.bodyStyle,
    colorOptions: row.colorOptions,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.userId,
    vehicleId: row.vehicleId,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
    totalPrice: Number(row.totalPrice),
    vehicleLabel: row.vehicleLabel,
    createdAt: row.createdAt,
  };
}
