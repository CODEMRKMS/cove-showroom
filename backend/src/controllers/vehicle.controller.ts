import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_PAGE_SIZE, SORT_OPTIONS } from '../domain/pagination.js';
import { CATEGORIES } from '../domain/vehicle.js';
import { idParams } from '../http/params.js';
import { parseWith } from '../http/validate.js';
import type { VehicleService } from '../services/vehicle.service.js';

// Largest price accepted: 1e12 paise (10,000 crore rupees), far below 2^53 so it round-trips as a JSON number.
const MAX_PRICE = 1_000_000_000_000;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

// Field rules shared by create and update.
const fields = {
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  category: z.enum(CATEGORIES),
  price: z.number().int().positive().max(MAX_PRICE),
  year: z
    .number()
    .int()
    .min(1886)
    .max(new Date().getFullYear() + 1),
  bodyStyle: z.enum(CATEGORIES),
  colorOptions: z.array(z.string().regex(HEX_COLOUR)).max(8),
  description: z.string().trim().max(2000),
};

// .strict() rejects unknown keys, so clients cannot set id, deletedAt or timestamps.
const createBody = z
  .object({
    ...fields,
    quantity: z.number().int().min(0).max(100_000),
    year: fields.year.optional(),
    bodyStyle: fields.bodyStyle.optional(),
    colorOptions: fields.colorOptions.default([]),
    description: fields.description.optional(),
  })
  .strict();

// Partial update. Quantity is deliberately absent: stock moves only through purchase and restock,
// so every change to it is recorded in the inventory ledger. null clears an optional field.
const updateBody = z
  .object({
    ...fields,
    year: fields.year.nullable(),
    description: fields.description.nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Send at least one field to update.',
  });

// Query strings arrive as text, so numbers are coerced. Unknown parameters are rejected, not ignored.
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  sort: z.enum(SORT_OPTIONS).default('-createdAt'),
};

const listQuery = z.object(paging).strict();

// Prices in a query are whole minor units. A pattern check rather than coerce, because
// Number('') is 0 and would let an empty parameter through as a real bound.
const priceParam = z
  .string()
  .regex(/^\d+$/, 'Must be a whole number of paise.')
  .transform(Number)
  .pipe(z.number().max(MAX_PRICE));

const searchQuery = z
  .object({
    ...paging,
    q: z.string().trim().min(1).max(100).optional(),
    make: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().min(1).max(60).optional(),
    category: z.enum(CATEGORIES).optional(),
    minPrice: priceParam.optional(),
    maxPrice: priceParam.optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['minPrice'],
        message: 'minPrice must not be greater than maxPrice.',
      });
    }
  });

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseWith(createBody, req.body);
    // authenticate has run, so req.user is set.
    res.status(201).json(await this.vehicles.create(input, req.user!.id));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseWith(idParams, req.params);
    const patch = parseWith(updateBody, req.body);
    res.json(await this.vehicles.update(id, patch, req.user!.id));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseWith(idParams, req.params);
    res.json(await this.vehicles.get(id));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const { page, pageSize, sort, ...filters } = parseWith(searchQuery, req.query);
    res.json(await this.vehicles.search(filters, { page, pageSize, sort }));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.vehicles.list(parseWith(listQuery, req.query)));
  };
}
