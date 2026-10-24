import { ApiError } from '../api/client';

/** Turns any failure into one sentence a person can act on. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED')
      return 'Too many attempts. Wait a few minutes, then try again.';
    if (error.status >= 500) return `${error.detail} Try again in a moment.`;
    return error.detail;
  }
  return 'Something unexpected went wrong. Try again.';
}
