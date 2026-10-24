export const MIN_PASSWORD_LENGTH = 10;

// A deliberately small deny-list of the most common passwords that are long
// enough to pass the length rule. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  '1234567890',
  '0123456789',
  '12345678910',
  'password123',
  'password1234',
  'passw0rd123',
  'qwertyuiop',
  'qwerty12345',
  'qwerty123456',
  'iloveyou123',
  'welcome1234',
  'administrator',
  'letmein1234',
  '1q2w3e4r5t',
  'abcdefghij',
]);

/** Returns a human-readable problem, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common. Choose something less guessable.';
  }
  return null;
}
