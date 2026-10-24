import { z } from 'zod';

// The password rule mirrors the backend (backend/src/domain/password-policy.ts). The server still
// decides; this only saves a round trip and explains the rule before the person submits.
export const MIN_PASSWORD_LENGTH = 10;

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address, like name@example.com.'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.'),
  email,
  password: z
    .string()
    .min(1, 'Choose a password.')
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
});

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** First problem per field, ready to show beside the inputs. Empty when the values are valid. */
export function fieldErrors<K extends string>(
  schema: z.ZodType,
  values: Record<K, string>,
): FieldErrors<K> {
  const result = schema.safeParse(values);
  const errors: FieldErrors<K> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as K;
      errors[key] ??= issue.message;
    }
  }
  return errors;
}
