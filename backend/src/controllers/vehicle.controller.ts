import type { Request, Response } from 'express';
import { z } from 'zod';
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

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseWith(createBody, req.body);
    // authenticate has run, so req.user is set.
    res.status(201).json(await this.vehicles.create(input, req.user!.id));
  };
}
