import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service.js';

const registerBody = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
});

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = registerBody.parse(req.body);
    res.status(201).json(await this.auth.register(input));
  };
}
