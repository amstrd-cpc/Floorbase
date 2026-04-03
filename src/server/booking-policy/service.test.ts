import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBookingConfig, type BookingVenueWithEvents } from './service';

const baseVenue = {
  id: 'v1',
  organizationId: 'o1',
  slug: 'venue',
  name: 'Venue',
  timezone: 'UTC',
  publicBookingEnabled: true,
  bookingMode: 'AUTO_CONFIRM',
  placementMode: 'AUTO_ASSIGN',
  minPartySize: 1,
  maxOnlinePartySize: 10,
  minAdvanceNoticeMinutes: 60,
  maxDaysAhead: 30,
  defaultReservationDurationMinutes: 120,
  publicInstructions: null,
  bookingEvents: []
} satisfies BookingVenueWithEvents;

test('single-date events win over date-range and weekly events', () => {
  const bookingDate = new Date('2026-07-04T12:00:00.000Z');
  const resolved = resolveBookingConfig({
    venue: {
      ...baseVenue,
      bookingEvents: [
        {
          id: 'weekly',
          venueId: baseVenue.id,
          isActive: true,
          name: 'weekly',
          eventType: 'WEEKLY_RECURRING',
          singleDate: null,
          dateStart: null,
          dateEnd: null,
          weekdays: [6],
          confirmationMode: null,
          placementMode: null,
          minPartySize: null,
          maxOnlinePartySize: null,
          minAdvanceNoticeMinutes: null,
          maxDaysAhead: null,
          durationMinutes: null,
          publicInstructions: null,
          publicLabel: null,
          allowedAreaIds: [],
          allowedTableIds: [],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          id: 'range',
          venueId: baseVenue.id,
          isActive: true,
          name: 'range',
          eventType: 'DATE_RANGE',
          singleDate: null,
          dateStart: new Date('2026-07-01T00:00:00.000Z'),
          dateEnd: new Date('2026-07-07T00:00:00.000Z'),
          weekdays: [],
          confirmationMode: null,
          placementMode: 'TABLE_SELECTION',
          minPartySize: null,
          maxOnlinePartySize: null,
          minAdvanceNoticeMinutes: null,
          maxDaysAhead: null,
          durationMinutes: null,
          publicInstructions: null,
          publicLabel: null,
          allowedAreaIds: [],
          allowedTableIds: [],
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z')
        },
        {
          id: 'single',
          venueId: baseVenue.id,
          isActive: true,
          name: 'single',
          eventType: 'SINGLE_DATE',
          singleDate: new Date('2026-07-04T00:00:00.000Z'),
          dateStart: null,
          dateEnd: null,
          weekdays: [],
          confirmationMode: 'REQUEST_ONLY',
          placementMode: null,
          minPartySize: null,
          maxOnlinePartySize: null,
          minAdvanceNoticeMinutes: null,
          maxDaysAhead: null,
          durationMinutes: null,
          publicInstructions: null,
          publicLabel: null,
          allowedAreaIds: [],
          allowedTableIds: [],
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-03T00:00:00.000Z')
        }
      ]
    },
    bookingDate
  });

  assert.equal(resolved.winningEvent?.id, 'single');
  assert.equal(resolved.config.confirmationMode, 'REQUEST_ONLY');
});

test('shorter matching date range wins over longer range', () => {
  const resolved = resolveBookingConfig({
    venue: {
      ...baseVenue,
      bookingEvents: [
        {
          id: 'long',
          venueId: baseVenue.id,
          isActive: true,
          name: 'long',
          eventType: 'DATE_RANGE',
          singleDate: null,
          dateStart: new Date('2026-12-01T00:00:00.000Z'),
          dateEnd: new Date('2026-12-31T00:00:00.000Z'),
          weekdays: [],
          confirmationMode: null,
          placementMode: 'AUTO_ASSIGN',
          minPartySize: null,
          maxOnlinePartySize: null,
          minAdvanceNoticeMinutes: null,
          maxDaysAhead: null,
          durationMinutes: null,
          publicInstructions: null,
          publicLabel: null,
          allowedAreaIds: [],
          allowedTableIds: [],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          id: 'short',
          venueId: baseVenue.id,
          isActive: true,
          name: 'short',
          eventType: 'DATE_RANGE',
          singleDate: null,
          dateStart: new Date('2026-12-20T00:00:00.000Z'),
          dateEnd: new Date('2026-12-24T00:00:00.000Z'),
          weekdays: [],
          confirmationMode: null,
          placementMode: 'TABLE_SELECTION',
          minPartySize: null,
          maxOnlinePartySize: null,
          minAdvanceNoticeMinutes: null,
          maxDaysAhead: null,
          durationMinutes: null,
          publicInstructions: null,
          publicLabel: null,
          allowedAreaIds: [],
          allowedTableIds: [],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z')
        }
      ]
    },
    bookingDate: new Date('2026-12-23T12:00:00.000Z')
  });

  assert.equal(resolved.winningEvent?.id, 'short');
  assert.equal(resolved.config.placementMode, 'TABLE_SELECTION');
});
