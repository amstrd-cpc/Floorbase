export const RESERVATION_SLOT_MINUTES = 15;
export const DEFAULT_RESERVATION_DURATION_MINUTES = 120;
export const MIN_RESERVATION_DURATION_MINUTES = 30;
export const MAX_RESERVATION_DURATION_MINUTES = 300;
export const MAX_PARTY_SIZE = 50;

const BOOKING_STATUS_CODES = [
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
] as const;

const terminalStatuses = new Set(['COMPLETED', 'NO_SHOW', 'CANCELLED']);

const allowedStatusTransitions: Record<string, ReadonlySet<string>> = {
  PENDING: new Set([
    'PENDING',
    'CONFIRMED',
    'SEATED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
  ]),
  CONFIRMED: new Set([
    'CONFIRMED',
    'SEATED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
  ]),
  SEATED: new Set(['SEATED', 'COMPLETED', 'CANCELLED']),
  COMPLETED: new Set(['COMPLETED']),
  NO_SHOW: new Set(['NO_SHOW']),
  CANCELLED: new Set(['CANCELLED'])
};

export function normalizeBookingStatusCode(statusCode: string) {
  const normalized = statusCode.trim().toUpperCase();
  if (normalized === 'CANCELED') {
    return 'CANCELLED';
  }
  return normalized;
}

export function toBookingLifecycleStatus(statusCode: string) {
  const normalized = normalizeBookingStatusCode(statusCode);
  if ((BOOKING_STATUS_CODES as readonly string[]).includes(normalized)) {
    return normalized as (typeof BOOKING_STATUS_CODES)[number];
  }

  return 'PENDING';
}

export function validateSlotAligned(date: Date) {
  return date.getUTCMinutes() % RESERVATION_SLOT_MINUTES === 0;
}

export function canTransitionReservationStatus(
  fromCode: string,
  toCode: string
) {
  const normalizedFrom = normalizeBookingStatusCode(fromCode);
  const normalizedTo = normalizeBookingStatusCode(toCode);
  const allowed = allowedStatusTransitions[normalizedFrom];

  if (!allowed) {
    return !terminalStatuses.has(normalizedFrom);
  }

  return allowed.has(normalizedTo);
}
