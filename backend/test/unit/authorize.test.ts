import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { authorize } from '../../src/middleware/authorize.js';

describe('authorize', () => {
  it('answers UNAUTHENTICATED when it runs before authenticate, instead of trusting a missing user', () => {
    const next = vi.fn();

    authorize('GET /api/auth/me')({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });
});
