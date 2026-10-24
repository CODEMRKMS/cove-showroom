import type { Request, Response } from 'express';
import { z } from 'zod';
import { parseWith } from '../http/validate.js';
import type { EventService } from '../services/event.service.js';

const MAX_FEED_LIMIT = 100;

const eventsQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(MAX_FEED_LIMIT).default(20) })
  .strict();

/** Parses HTTP input and shapes HTTP output; who may call these routes is decided by the policy map. */
export class AdminController {
  constructor(private readonly eventService: EventService) {}

  events = async (req: Request, res: Response): Promise<void> => {
    const { limit } = parseWith(eventsQuery, req.query);
    res.json(await this.eventService.listRecent(limit));
  };
}
