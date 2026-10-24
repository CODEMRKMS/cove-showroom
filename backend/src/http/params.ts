import { z } from 'zod';

/** Route parameters for any `/:id` route. A malformed id is a 400, never a database type error. */
export const idParams = z.object({ id: z.uuid() }).strict();
