import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_PAGE_SIZE, SORT_OPTIONS } from '../domain/pagination.js';
import { CATEGORIES } from '../domain/vehicle.js';
import { parseWith } from '../http/validate.js';
import type { VehicleService } from '../services/vehicle.service.js';

// Largest price accepted: 1e12 paise (10,000 crore rupees), far below 2^53 so it round-trips as a JSON number.
const MAX_PRICE = 1_000_000_000_000;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

// .strict() rejects unknown keys, so clients cannot set id, deletedAt or timestamps.
const createBody = z
  .object({
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    category: z.enum(CATEGORIES),
    price: z.number().int().positive().max(MAX_PRICE),
    quantity: z.number().int().min(0).max(100_000),
    year: z
      .number()
      .int()
      .min(1886)
      .max(new Date().getFullYear() + 1)
      .optional(),
    bodyStyle: z.enum(CATEGORIES).optional(),
    colorOptions: z.array(z.string().regex(HEX_COLOUR)).max(8).default([]),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

// Query strings arrive as text, so numbers are coerced. Unknown parameters are rejected, not ignored.
const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    sort: z.enum(SORT_OPTIONS).default('-createdAt'),
  })
  .strict();

const idParams = z.object({ id: z.uuid() }).strict();

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseWith(createBody, req.body);
    // authenticate has run, so req.user is set.
    res.status(201).json(await this.vehicles.create(input, req.user!.id));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseWith(idParams, req.params);
    res.json(await this.vehicles.get(id));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.vehicles.list(parseWith(listQuery, req.query)));
  };
}
