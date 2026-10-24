import type { InventoryEvent } from '../domain/inventory-event.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { EventRepository } from './event.repository.js';

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecent(limit: number): Promise<InventoryEvent[]> {
    const rows = await this.prisma.inventoryEvent.findMany({
      // id breaks ties, so events written in the same instant keep a stable order.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
      // Select only what the feed shows: never the actor's email or password hash.
      select: {
        id: true,
        type: true,
        delta: true,
        quantityAfter: true,
        createdAt: true,
        vehicle: { select: { id: true, make: true, model: true } },
        actor: { select: { id: true, name: true } },
      },
    });
    return rows;
  }
}
