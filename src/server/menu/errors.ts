export class MenuValidationError extends Error {
  readonly details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'MenuValidationError';
    this.details = details;
  }
}

export class MenuNotFoundError extends Error {
  constructor(message = 'Menu entity not found.') {
    super(message);
    this.name = 'MenuNotFoundError';
  }
}
