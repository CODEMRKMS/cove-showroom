import type { Order } from '../domain/order.js';
import type { PageParams, PageResult } from '../domain/pagination.js';

/** Persistence contract for reading orders. Orders are written by the inventory repository's purchase. */
export interface OrderRepository {
  /** One user's orders, newest first. Includes orders for vehicles that were later soft-deleted. */
  findByUser(userId: string, page: PageParams): Promise<PageResult<Order>>;
}
