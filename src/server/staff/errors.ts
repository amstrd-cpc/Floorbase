export class StaffValidationError extends Error {
  readonly details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'StaffValidationError';
    this.details = details;
  }
}

export class StaffNotFoundError extends Error {
  constructor(message = 'Staff member not found.') {
    super(message);
    this.name = 'StaffNotFoundError';
  }
}
