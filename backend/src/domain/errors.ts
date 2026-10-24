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

export class EmailTakenError extends AppError {
  constructor() {
    super(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }
}
