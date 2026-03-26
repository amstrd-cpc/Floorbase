export class FloorValidationError extends Error {
  readonly details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'FloorValidationError';
    this.details = details;
  }
}

export class FloorNotFoundError extends Error {
  constructor(message = 'Floor entity not found.') {
    super(message);
    this.name = 'FloorNotFoundError';
  }
}
