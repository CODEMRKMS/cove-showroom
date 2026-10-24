import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';

describe('GET /api/health', () => {
  it('answers 200 with status ok and needs no authentication', async () => {
    const res = await request(buildTestApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
