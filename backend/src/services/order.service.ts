import type { Order } from '../domain/order.js';
import { paginate, type PageParams, type Paginated } from '../domain/pagination.js';
import type { OrderRepository } from '../repositories/order.repository.js';

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  /** The user id always comes from the verified token, so a caller can only ever read their own orders. */
  async listMine(userId: string, page: PageParams): Promise<Paginated<Order>> {
    return paginate(await this.orders.findByUser(userId, page), page);
  }
}
