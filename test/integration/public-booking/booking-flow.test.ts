import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import {
  setupTestDatabase,
  seedFixture,
  resetReservationData,
  type TestFixture
} from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;
let fixture: TestFixture;

let getPublicVenueBySlug: typeof import('@/server/public-booking/service').getPublicVenueBySlug;
let getPublicSlots: typeof import('@/server/public-booking/service').getPublicSlots;
let createPublicBooking: typeof import('@/server/public-booking/service').createPublicBooking;
let PublicBookingError: typeof import('@/server/public-booking/service').PublicBookingError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/public-booking/service');
  getPublicVenueBySlug = service.getPublicVenueBySlug;
  getPublicSlots = service.getPublicSlots;
  createPublicBooking = service.createPublicBooking;
  PublicBookingError = service.PublicBookingError;
});

after(async () => {
  await teardown();
});

beforeEach(async () => {
  await resetReservationData(prisma);
  fixture = await seedFixture(prisma);
});

function futureSlot(daysAhead: number, hourUtc: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

function bookingPayload(
  overrides: Partial<Parameters<typeof createPublicBooking>[0]['payload']> = {}
) {
  return {
    slotId: futureSlot(3, 18).toISOString(),
    partySize: 2,
    fullName: 'Guest Person',
    email: `guest-${Date.now()}-${Math.random()}@example.com`,
    phone: '+15551230000',
    selectedTableId: fixture.tableId,
    ...overrides
  };
}

test('getPublicVenueBySlug throws VENUE_NOT_AVAILABLE for an unknown slug', async () => {
  await assert.rejects(
    () => getPublicVenueBySlug('no-such-venue-slug'),
    (error: unknown) =>
      error instanceof PublicBookingError &&
      error.code === 'VENUE_NOT_AVAILABLE' &&
      error.status === 404
  );
});

test('getPublicSlots lists the fixture table as available on an open day', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);
  const dateText = futureSlot(3, 0).toISOString().slice(0, 10);

  const result = await getPublicSlots({ venue, dateText, partySize: 2 });

  assert.ok(
    result.slots.length > 0,
    'expected at least one open slot on a 24h business-hours day'
  );
  const anySlotHasTables = result.slots.some(
    (slot) => slot.availableTables.length > 0
  );
  assert.ok(
    anySlotHasTables,
    'expected at least one slot to list available tables'
  );
});

test('createPublicBooking (AUTO_CONFIRM + TABLE_SELECTION) creates a confirmed reservation on the selected table', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  const result = await createPublicBooking({
    venue,
    payload: bookingPayload()
  });

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: result.reservationId },
    include: { reservationTables: true, status: true }
  });
  assert.equal(reservation.bookingStatus, 'CONFIRMED');
  assert.equal(reservation.reservationTables.length, 1);
  assert.equal(reservation.reservationTables[0].tableId, fixture.tableId);
});

test('createPublicBooking (REQUEST_ONLY) creates a pending reservation instead of confirming it', async () => {
  await prisma.venue.update({
    where: { id: fixture.venueId },
    data: { bookingMode: 'REQUEST_ONLY' }
  });
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  const result = await createPublicBooking({
    venue,
    payload: bookingPayload()
  });

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: result.reservationId }
  });
  assert.equal(reservation.bookingStatus, 'PENDING');
});

test('createPublicBooking (AUTO_ASSIGN) picks a table automatically when none is selected', async () => {
  await prisma.venue.update({
    where: { id: fixture.venueId },
    data: { placementMode: 'AUTO_ASSIGN' }
  });
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  const result = await createPublicBooking({
    venue,
    payload: bookingPayload({ selectedTableId: undefined })
  });

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: result.reservationId },
    include: { reservationTables: true }
  });
  assert.equal(reservation.reservationTables.length, 1);
});

test('createPublicBooking (TABLE_SELECTION) rejects a request with no selected table', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  await assert.rejects(
    () =>
      createPublicBooking({
        venue,
        payload: bookingPayload({ selectedTableId: undefined })
      }),
    (error: unknown) =>
      error instanceof PublicBookingError && error.code === 'INVALID_INPUT'
  );
});

test('createPublicBooking rejects a party size above the venue online limit', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  await assert.rejects(
    () =>
      createPublicBooking({
        venue,
        payload: bookingPayload({ partySize: venue.maxOnlinePartySize + 1 })
      }),
    (error: unknown) =>
      error instanceof PublicBookingError &&
      error.code === 'PARTY_SIZE_TOO_LARGE'
  );
});

test('createPublicBooking rejects a slot inside the minimum advance notice window', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);
  const tooSoon = new Date(Date.now() + 5 * 60_000);

  await assert.rejects(
    () =>
      createPublicBooking({
        venue,
        payload: bookingPayload({ slotId: tooSoon.toISOString() })
      }),
    (error: unknown) =>
      error instanceof PublicBookingError && error.code === 'TOO_SOON'
  );
});

test('createPublicBooking rejects a table that is already booked for the window', async () => {
  const venue = await getPublicVenueBySlug(fixture.venueSlug);
  const payload = bookingPayload();

  await createPublicBooking({ venue, payload });

  await assert.rejects(
    () =>
      createPublicBooking({
        venue,
        payload: { ...payload, email: `second-${Date.now()}@example.com` }
      }),
    (error: unknown) =>
      error instanceof PublicBookingError &&
      error.code === 'SLOT_UNAVAILABLE' &&
      error.status === 409
  );
});
