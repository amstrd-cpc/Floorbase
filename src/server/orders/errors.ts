export class OrderValidationError extends Error {
  readonly details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'OrderValidationError';
    this.details = details;
  }
}

export class OrderNotFoundError extends Error {
  constructor(message = 'Order not found.') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}
