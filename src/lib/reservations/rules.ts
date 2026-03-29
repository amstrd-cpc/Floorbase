export const RESERVATION_SLOT_MINUTES = 15;
export const DEFAULT_RESERVATION_DURATION_MINUTES = 120;
export const MIN_RESERVATION_DURATION_MINUTES = 30;
export const MAX_RESERVATION_DURATION_MINUTES = 300;
export const MAX_PARTY_SIZE = 50;

const terminalStatuses = new Set(['COMPLETED', 'NO_SHOW', 'CANCELED']);

const allowedStatusTransitions: Record<string, ReadonlySet<string>> = {
  PENDING: new Set(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELED']),
  CONFIRMED: new Set(['CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELED']),
  SEATED: new Set(['SEATED', 'COMPLETED', 'CANCELED']),
  COMPLETED: new Set(['COMPLETED']),
  NO_SHOW: new Set(['NO_SHOW']),
  CANCELED: new Set(['CANCELED'])
};

export function validateSlotAligned(date: Date) {
  return date.getUTCMinutes() % RESERVATION_SLOT_MINUTES === 0;
}

export function canTransitionReservationStatus(fromCode: string, toCode: string) {
  const normalizedFrom = fromCode.toUpperCase();
  const normalizedTo = toCode.toUpperCase();
  const allowed = allowedStatusTransitions[normalizedFrom];

  if (!allowed) {
    return !terminalStatuses.has(normalizedFrom);
  }

  return allowed.has(normalizedTo);
}
