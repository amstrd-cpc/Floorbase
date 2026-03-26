import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  computeReservationWindow,
  hasOverlappingWindow,
  validateSlotAligned
} from './availability';

test('computeReservationWindow uses default duration when endAt is not provided', () => {
  const startAt = new Date('2026-01-01T18:00:00.000Z');
  const window = computeReservationWindow({ startAt });

  assert.equal(window.durationMinutes, DEFAULT_RESERVATION_DURATION_MINUTES);
  assert.equal(window.endAt.toISOString(), '2026-01-01T20:00:00.000Z');
});

test('computeReservationWindow uses explicit duration when provided', () => {
  const startAt = new Date('2026-01-01T18:00:00.000Z');
  const window = computeReservationWindow({ startAt, durationMinutes: 90 });

  assert.equal(window.durationMinutes, 90);
  assert.equal(window.endAt.toISOString(), '2026-01-01T19:30:00.000Z');
});

test('hasOverlappingWindow finds overlap only for intersecting windows', () => {
  const startAt = new Date('2026-01-01T18:00:00.000Z');
  const endAt = new Date('2026-01-01T20:00:00.000Z');

  assert.equal(
    hasOverlappingWindow({
      startAt,
      endAt,
      compareStartAt: new Date('2026-01-01T19:30:00.000Z'),
      compareEndAt: new Date('2026-01-01T21:00:00.000Z')
    }),
    true
  );

  assert.equal(
    hasOverlappingWindow({
      startAt,
      endAt,
      compareStartAt: new Date('2026-01-01T20:00:00.000Z'),
      compareEndAt: new Date('2026-01-01T21:00:00.000Z')
    }),
    false
  );
});

test('validateSlotAligned verifies 15-minute slot alignment', () => {
  assert.equal(validateSlotAligned(new Date('2026-01-01T18:15:00.000Z')), true);
  assert.equal(
    validateSlotAligned(new Date('2026-01-01T18:10:00.000Z')),
    false
  );
});
