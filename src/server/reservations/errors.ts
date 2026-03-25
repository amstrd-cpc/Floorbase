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
