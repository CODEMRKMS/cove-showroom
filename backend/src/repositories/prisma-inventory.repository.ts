import { OutOfStockError, VehicleNotFoundError } from '../domain/errors.js';
import type { Vehicle } from '../domain/vehicle.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type {
  InventoryRepository,
  PurchaseRequest,
  PurchaseResult,
  RestockRequest,
} from './inventory.repository.js';
import { toOrder, toVehicle } from './prisma-mappers.js';

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  purchase({ vehicleId, userId, quantity }: PurchaseRequest): Promise<PurchaseResult> {
    return this.prisma.$transaction(async (tx) => {
      // One statement checks the stock and takes it. PostgreSQL locks the row, so a
      // concurrent buyer waits, then re-checks `quantity >= n` against the new value.
      // There is no read-then-write gap for two buyers to slip through.
      const { count } = await tx.vehicle.updateMany({
        where: { id: vehicleId, deletedAt: null, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });

      if (count === 0) {
        const current = await tx.vehicle.findFirst({
          where: { id: vehicleId, deletedAt: null },
          select: { quantity: true },
        });
        if (!current) throw new VehicleNotFoundError();
        throw new OutOfStockError(current.quantity);
      }

      // Our own update holds the row lock until commit, so this read is the price we sold at.
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
      const order = await tx.order.create({
        data: {
          userId,
          vehicleId,
          quantity,
          unitPrice: vehicle.price,
          totalPrice: vehicle.price * BigInt(quantity),
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
        },
      });
      await tx.inventoryEvent.create({
        data: {
          vehicleId,
          actorId: userId,
          type: 'PURCHASED',
          delta: -quantity,
          quantityAfter: vehicle.quantity,
        },
      });
      return { vehicle: toVehicle(vehicle), order: toOrder(order) };
    });
  }

  restock({ vehicleId, actorId, quantity }: RestockRequest): Promise<Vehicle> {
    return this.prisma.$transaction(async (tx) => {
      // An atomic increment, so simultaneous restocks add up instead of overwriting each other.
      const { count } = await tx.vehicle.updateMany({
        where: { id: vehicleId, deletedAt: null },
        data: { quantity: { increment: quantity } },
      });
      if (count === 0) throw new VehicleNotFoundError();

      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
      await tx.inventoryEvent.create({
        data: {
          vehicleId,
          actorId,
          type: 'RESTOCKED',
          delta: quantity,
          quantityAfter: vehicle.quantity,
        },
      });
      return toVehicle(vehicle);
    });
  }
}
