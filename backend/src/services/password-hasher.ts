import argon2 from 'argon2';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

/** argon2id with the library's current recommended parameters. */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }
}
