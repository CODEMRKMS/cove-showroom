import type { Request, Response } from 'express';
import { z } from 'zod';
import { passwordProblem } from '../domain/password-policy.js';
import { parseWith } from '../http/validate.js';
import type { AuthService } from '../services/auth.service.js';

// .strict() rejects unknown keys, so a client can never smuggle in `role`.
const registerBody = z
  .object({
    email: z.email().max(254),
    password: z
      .string()
      .max(128)
      .superRefine((value, ctx) => {
        const problem = passwordProblem(value);
        if (problem) ctx.addIssue({ code: 'custom', message: problem });
      }),
    name: z.string().trim().min(1).max(100),
  })
  .strict();

const loginBody = z.object({ email: z.string(), password: z.string() }).strict();

/** Parses HTTP input and shapes HTTP output; business rules live in the service. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = parseWith(registerBody, req.body);
    res.status(201).json(await this.auth.register(input));
  };

  me = (req: Request, res: Response): void => {
    res.json(req.user);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = parseWith(loginBody, req.body);
    res.status(200).json(await this.auth.login(input));
  };
}
