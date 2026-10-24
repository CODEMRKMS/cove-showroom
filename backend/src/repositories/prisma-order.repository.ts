import type { Order } from '../domain/order.js';
import type { PageParams, PageResult } from '../domain/pagination.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { OrderRepository } from './order.repository.js';
import { toOrder } from './prisma-mappers.js';

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(userId: string, { page, pageSize }: PageParams): Promise<PageResult<Order>> {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        // id breaks ties, so orders placed in the same instant still page deterministically.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map(toOrder), total };
  }
}
