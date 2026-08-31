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

// Dynamically imported after DATABASE_URL is pointed at the test database,
// so the app's module-level PrismaClient singleton (src/server/db/prisma/client.ts)
// connects to the disposable test DB instead of whatever DATABASE_URL was at
// process start.
let createReservation: typeof import('@/server/reservations/service').createReservation;
let setReservationTableAssignment: typeof import('@/server/reservations/assignment-service').setReservationTableAssignment;
let createPublicBooking: typeof import('@/server/public-booking/service').createPublicBooking;
let getPublicVenueBySlug: typeof import('@/server/public-booking/service').getPublicVenueBySlug;
let PublicBookingError: typeof import('@/server/public-booking/service').PublicBookingError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/reservations/service');
  const assignmentService =
    await import('@/server/reservations/assignment-service');
  const publicBookingService = await import('@/server/public-booking/service');

  createReservation = service.createReservation;
  setReservationTableAssignment =
    assignmentService.setReservationTableAssignment;
  createPublicBooking = publicBookingService.createPublicBooking;
  getPublicVenueBySlug = publicBookingService.getPublicVenueBySlug;
  PublicBookingError = publicBookingService.PublicBookingError;
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

function buildCreateReservationPayload(input: {
  tableId: string;
  startAt: Date;
  guestSuffix: string | number;
}) {
  return {
    venueId: fixture.venueId,
    reservationDate: input.startAt,
    startAt: input.startAt,
    durationMinutes: 90,
    partySize: 2,
    guest: {
      fullName: `Racer ${input.guestSuffix}`,
      email: `racer-${input.guestSuffix}-${Date.now()}@example.com`,
      phone: '+15551230000'
    },
    tableIds: [input.tableId],
    source: 'ADMIN',
    depositRequired: false
  };
}

async function raceSettled<T>(
  count: number,
  fn: (index: number) => Promise<T>
) {
  return Promise.allSettled(
    Array.from({ length: count }, (_, index) => fn(index))
  );
}

function countFulfilled<T>(results: PromiseSettledResult<T>[]) {
  return results.filter((result) => result.status === 'fulfilled').length;
}

async function assertExactlyOneReservationTableRow(input: {
  tableId: string;
  startAt: Date;
  endAt: Date;
}) {
  const rows = await prisma.reservationTable.findMany({
    where: { tableId: input.tableId },
    include: { reservation: { select: { startAt: true, endAt: true } } }
  });

  const matching = rows.filter(
    (row) =>
      row.reservation.startAt.getTime() === input.startAt.getTime() &&
      row.reservation.endAt.getTime() === input.endAt.getTime()
  );

  assert.equal(
    matching.length,
    1,
    `expected exactly 1 ReservationTable row for table ${input.tableId} in this window, found ${matching.length}`
  );
}

async function assertRejectedWithTypedConflict(
  results: PromiseSettledResult<unknown>[]
) {
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  for (const result of rejected) {
    const reason = result.reason as { name?: string } | undefined;
    assert.equal(
      reason?.name,
      'ReservationConflictError',
      `expected a typed ReservationConflictError, got: ${String(reason)}`
    );
  }
}

test('createReservation: N=2 concurrent bookings for the same table/window — exactly one wins', async () => {
  const startAt = futureSlot(3, 18);
  const endAt = new Date(startAt.getTime() + 90 * 60_000);

  const results = await raceSettled(2, (index) =>
    createReservation({
      organizationId: fixture.organizationId,
      payload: buildCreateReservationPayload({
        tableId: fixture.tableId,
        startAt,
        guestSuffix: index
      }),
      context: { actorUserId: fixture.actorUserId }
    })
  );

  assert.equal(
    countFulfilled(results),
    1,
    'expected exactly 1 of 2 concurrent creates to succeed'
  );
  await assertRejectedWithTypedConflict(results);
  await assertExactlyOneReservationTableRow({
    tableId: fixture.tableId,
    startAt,
    endAt
  });
});

test('createReservation: N=10 concurrent bookings for the same table/window — exactly one wins', async () => {
  const startAt = futureSlot(4, 19);
  const endAt = new Date(startAt.getTime() + 90 * 60_000);

  const results = await raceSettled(10, (index) =>
    createReservation({
      organizationId: fixture.organizationId,
      payload: buildCreateReservationPayload({
        tableId: fixture.tableId,
        startAt,
        guestSuffix: index
      }),
      context: { actorUserId: fixture.actorUserId }
    })
  );

  assert.equal(
    countFulfilled(results),
    1,
    'expected exactly 1 of 10 concurrent creates to succeed'
  );
  await assertRejectedWithTypedConflict(results);
  await assertExactlyOneReservationTableRow({
    tableId: fixture.tableId,
    startAt,
    endAt
  });
});

test('createPublicBooking: concurrent public bookings for the same table/window — exactly one wins', async () => {
  const startAt = futureSlot(5, 20);
  const endAt = new Date(startAt.getTime() + fixtureDurationMinutes() * 60_000);
  const venue = await getPublicVenueBySlug(fixture.venueSlug);

  const results = await raceSettled(5, (index) =>
    createPublicBooking({
      venue,
      payload: {
        slotId: startAt.toISOString(),
        partySize: 2,
        fullName: `Public Racer ${index}`,
        email: `public-racer-${index}-${Date.now()}@example.com`,
        phone: '+15551230000',
        selectedTableId: fixture.tableId
      }
    })
  );

  assert.equal(
    countFulfilled(results),
    1,
    'expected exactly 1 of 5 concurrent public bookings to succeed'
  );

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  for (const result of rejected) {
    assert.ok(
      result.reason instanceof PublicBookingError,
      `expected a typed PublicBookingError, got: ${String(result.reason)}`
    );
    assert.equal(
      (result.reason as InstanceType<typeof PublicBookingError>).status,
      409
    );
  }

  await assertExactlyOneReservationTableRow({
    tableId: fixture.tableId,
    startAt,
    endAt
  });
});

test('setReservationTableAssignment: two reservations racing to claim the same table — exactly one wins', async () => {
  const startAt = futureSlot(6, 12);

  // Seed two reservations up front, each on its own placeholder table, so
  // neither creation conflicts with the other — only the *reassignment* race
  // (both targeting fixture.tableId) is under test here.
  const reservationA = await createReservation({
    organizationId: fixture.organizationId,
    payload: buildCreateReservationPayload({
      tableId: fixture.secondaryTableId,
      startAt,
      guestSuffix: 'A'
    }),
    context: { actorUserId: fixture.actorUserId }
  });
  const reservationB = await createReservation({
    organizationId: fixture.organizationId,
    payload: buildCreateReservationPayload({
      tableId: fixture.tertiaryTableId,
      startAt,
      guestSuffix: 'B'
    }),
    context: { actorUserId: fixture.actorUserId }
  });

  const results = await Promise.allSettled([
    setReservationTableAssignment({
      organizationId: fixture.organizationId,
      reservationId: reservationA.id,
      tableId: fixture.tableId,
      context: { actorUserId: fixture.actorUserId }
    }),
    setReservationTableAssignment({
      organizationId: fixture.organizationId,
      reservationId: reservationB.id,
      tableId: fixture.tableId,
      context: { actorUserId: fixture.actorUserId }
    })
  ]);

  assert.equal(
    countFulfilled(results),
    1,
    'expected exactly 1 of 2 concurrent reassignments to succeed'
  );
  await assertRejectedWithTypedConflict(results);

  const endAt = new Date(startAt.getTime() + 90 * 60_000);
  await assertExactlyOneReservationTableRow({
    tableId: fixture.tableId,
    startAt,
    endAt
  });
});

function fixtureDurationMinutes() {
  // createPublicBooking falls back to venue.defaultReservationDurationMinutes
  // when no BookingEvent overrides it; the seeded venue uses the schema default (120).
  return 120;
}
