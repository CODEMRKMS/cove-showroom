import type { PageRequest, PageResult, VehicleSort } from '../domain/pagination.js';
import type { Vehicle } from '../domain/vehicle.js';
import type { Prisma, PrismaClient, Vehicle as VehicleRow } from '../generated/prisma/client.js';
import type { NewVehicle, VehicleRepository } from './vehicle.repository.js';

// Prices are BigInt in the database and number everywhere else. That is safe
// because the API caps them far below 2^53.
function toVehicle(row: VehicleRow): Vehicle {
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

// Every order ends with id so rows with equal sort values still page deterministically.
const ORDER_BY: Record<VehicleSort, Prisma.VehicleOrderByWithRelationInput[]> = {
  price: [{ price: 'asc' }, { id: 'asc' }],
  '-price': [{ price: 'desc' }, { id: 'asc' }],
  make: [{ make: 'asc' }, { model: 'asc' }, { id: 'asc' }],
  '-createdAt': [{ createdAt: 'desc' }, { id: 'asc' }],
};

export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(vehicle: NewVehicle, actorId: string): Promise<Vehicle> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.vehicle.create({ data: { ...vehicle, price: BigInt(vehicle.price) } });
      await tx.inventoryEvent.create({
        data: {
          vehicleId: row.id,
          actorId,
          type: 'CREATED',
          delta: row.quantity,
          quantityAfter: row.quantity,
        },
      });
      return toVehicle(row);
    });
  }

  async findMany({ page, pageSize, sort }: PageRequest): Promise<PageResult<Vehicle>> {
    const where = { deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: ORDER_BY[sort],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { items: rows.map(toVehicle), total };
  }
}
