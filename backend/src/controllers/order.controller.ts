import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../domain/pagination.js';
import { parseWith } from '../http/validate.js';
import type { OrderService } from '../services/order.service.js';

// Unlike vehicles there is no sort option: orders are always newest first.
const mineQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  })
  .strict();

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  mine = async (req: Request, res: Response): Promise<void> => {
    const page = parseWith(mineQuery, req.query);
    res.json(await this.orders.listMine(req.user!.id, page));
  };
}
