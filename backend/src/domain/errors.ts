export type FieldError = { field: string; message: string };

/** An error the API deliberately reports to the client with a status and a stable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[]) {
    super(400, 'VALIDATION_ERROR', 'The request is invalid.', errors);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'FORBIDDEN', 'You do not have permission to do this.');
  }
}

export class RateLimitedError extends AppError {
  constructor() {
    super(429, 'RATE_LIMITED', 'Too many failed attempts. Try again later.');
  }
}

export class EmailTakenError extends AppError {
  constructor() {
    super(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }
}

export class VehicleNotFoundError extends AppError {
  constructor() {
    super(404, 'VEHICLE_NOT_FOUND', 'No vehicle with this id.');
  }
}

export class OutOfStockError extends AppError {
  constructor(available: number) {
    super(409, 'OUT_OF_STOCK', `Only ${available} ${available === 1 ? 'unit' : 'units'} left.`);
  }
}
