import {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  MAX_RESERVATION_DURATION_MINUTES,
  MIN_RESERVATION_DURATION_MINUTES,
  RESERVATION_SLOT_MINUTES,
  validateSlotAligned
} from '@/lib/reservations/rules';

export {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  MAX_RESERVATION_DURATION_MINUTES,
  MIN_RESERVATION_DURATION_MINUTES,
  RESERVATION_SLOT_MINUTES,
  validateSlotAligned
};

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function computeReservationWindow(input: {
  startAt: Date;
  endAt?: Date;
  durationMinutes?: number;
}) {
  const startAt = input.startAt;
  const endAt =
    input.endAt ??
    addMinutes(
      input.startAt,
      input.durationMinutes ?? DEFAULT_RESERVATION_DURATION_MINUTES
    );

  const durationMinutes = Math.round(
    (endAt.getTime() - startAt.getTime()) / 60_000
  );

  return {
    startAt,
    endAt,
    durationMinutes
  };
}

export function hasOverlappingWindow(input: {
  startAt: Date;
  endAt: Date;
  compareStartAt: Date;
  compareEndAt: Date;
}) {
  return (
    input.compareStartAt < input.endAt && input.compareEndAt > input.startAt
  );
}
