import type { PageRequest, PageResult, VehicleSort } from '../domain/pagination.js';
import type { Vehicle } from '../domain/vehicle.js';
import type { Prisma, PrismaClient, Vehicle as VehicleRow } from '../generated/prisma/client.js';
import type {
  NewVehicle,
  VehicleFilter,
  VehiclePatch,
  VehicleRepository,
} from './vehicle.repository.js';

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

const insensitive = 'insensitive' as const;

// Prisma passes `contains` text straight into a LIKE pattern, so % and _ would act as wildcards.
// Escaping them (and the escape character) makes user text match literally.
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`);

function toWhere(filter: VehicleFilter): Prisma.VehicleWhereInput {
  const { terms = [], make, model, category, minPrice, maxPrice, inStock } = filter;
  return {
    deletedAt: null,
    ...(terms.length > 0 && {
      AND: terms.map((term) => ({
        OR: [
          { make: { contains: escapeLike(term), mode: insensitive } },
          { model: { contains: escapeLike(term), mode: insensitive } },
        ],
      })),
    }),
    ...(make !== undefined && { make: { equals: make, mode: insensitive } }),
    ...(model !== undefined && { model: { equals: model, mode: insensitive } }),
    ...(category !== undefined && { category }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: {
        ...(minPrice !== undefined && { gte: BigInt(minPrice) }),
        ...(maxPrice !== undefined && { lte: BigInt(maxPrice) }),
      },
    }),
    ...(inStock !== undefined && { quantity: inStock ? { gt: 0 } : 0 }),
  };
}

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

  update(id: string, patch: VehiclePatch, actorId: string): Promise<Vehicle | null> {
    const { price, ...rest } = patch;
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.vehicle.updateMany({
        where: { id, deletedAt: null },
        data: { ...rest, ...(price !== undefined && { price: BigInt(price) }) },
      });
      if (count === 0) return null;
      const row = await tx.vehicle.findUniqueOrThrow({ where: { id } });
      await tx.inventoryEvent.create({
        data: { vehicleId: id, actorId, type: 'UPDATED', delta: 0, quantityAfter: row.quantity },
      });
      return toVehicle(row);
    });
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    return row && toVehicle(row);
  }

  async findMany(
    { page, pageSize, sort }: PageRequest,
    filter: VehicleFilter = {},
  ): Promise<PageResult<Vehicle>> {
    const where = toWhere(filter);
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
