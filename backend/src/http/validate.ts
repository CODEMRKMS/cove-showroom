import type { z } from 'zod';
import { ValidationError, type FieldError } from '../domain/errors.js';

/** Parses `input` with `schema`, turning any failure into a ValidationError with per-field messages. */
export function parseWith<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const errors: FieldError[] = result.error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ field: key, message: 'This field is not allowed.' }))
      : [{ field: issue.path.join('.'), message: issue.message }],
  );
  throw new ValidationError(errors);
}
