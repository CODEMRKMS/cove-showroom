import type { Request, Response } from 'express';
import { z } from 'zod';
import { idParams } from '../http/params.js';
import { parseWith } from '../http/validate.js';
import type { InventoryService } from '../services/inventory.service.js';

const MAX_PURCHASE_QUANTITY = 10;

// The buyer comes from the token and the price from the database, so neither is accepted here.
const purchaseBody = z
  .object({ quantity: z.number().int().min(1).max(MAX_PURCHASE_QUANTITY).default(1) })
  .strict();

/** Parses HTTP input and shapes HTTP output; stock rules live in the repository transaction. */
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  purchase = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseWith(idParams, req.params);
    const { quantity } = parseWith(purchaseBody, req.body ?? {});
    res.json(await this.inventory.purchase(id, req.user!.id, quantity));
  };
}
