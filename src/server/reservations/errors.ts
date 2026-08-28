export class ReservationValidationError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ReservationValidationError';
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message = 'Reservation not found.') {
    super(message);
    this.name = 'ReservationNotFoundError';
  }
}

export class ReservationConflictError extends ReservationValidationError {
  constructor(
    message = 'Selected table is no longer available for this time window.',
    details?: Record<string, string>
  ) {
    super(message, details);
    this.name = 'ReservationConflictError';
  }
}
