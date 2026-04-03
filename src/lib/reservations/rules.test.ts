import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionReservationStatus,
  normalizeBookingStatusCode,
  toBookingLifecycleStatus
} from './rules';

test('normalizes canceled aliases and maps unknown statuses to pending', () => {
  assert.equal(normalizeBookingStatusCode('canceled'), 'CANCELLED');
  assert.equal(toBookingLifecycleStatus('canceled'), 'CANCELLED');
  assert.equal(toBookingLifecycleStatus('custom_status'), 'PENDING');
});

test('disallows transitions from completed into active states', () => {
  assert.equal(canTransitionReservationStatus('COMPLETED', 'CONFIRMED'), false);
  assert.equal(canTransitionReservationStatus('PENDING', 'CANCELLED'), true);
});
