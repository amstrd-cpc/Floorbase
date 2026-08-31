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

let createReservation: typeof import('@/server/reservations/service').createReservation;
let createDepositPaymentIntent: typeof import('@/server/deposits/service').createDepositPaymentIntent;
let markDepositPaidByPaymentIntent: typeof import('@/server/deposits/service').markDepositPaidByPaymentIntent;
let markDepositFailedByPaymentIntent: typeof import('@/server/deposits/service').markDepositFailedByPaymentIntent;
let DepositError: typeof import('@/server/deposits/errors').DepositError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;
  // @/server/deposits/service pulls in @/server/billing/stripe -> @/env,
  // which parses process.env eagerly at import time and requires this.
  process.env.AUTH_SESSION_SECRET ??= 'kQ7z2XpL9mR4vB8nT1yC6wF3hJ0sA5dE';

  const reservationService = await import('@/server/reservations/service');
  const depositService = await import('@/server/deposits/service');
  const depositErrors = await import('@/server/deposits/errors');

  createReservation = reservationService.createReservation;
  createDepositPaymentIntent = depositService.createDepositPaymentIntent;
  markDepositPaidByPaymentIntent =
    depositService.markDepositPaidByPaymentIntent;
  markDepositFailedByPaymentIntent =
    depositService.markDepositFailedByPaymentIntent;
  DepositError = depositErrors.DepositError;
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

async function createReservationWithDeposit(status: string) {
  return createReservation({
    organizationId: fixture.organizationId,
    payload: {
      venueId: fixture.venueId,
      reservationDate: futureSlot(3, 18),
      startAt: futureSlot(3, 18),
      durationMinutes: 90,
      partySize: 2,
      guest: {
        fullName: 'Deposit Guest',
        email: `deposit-${Date.now()}@example.com`,
        phone: '+15551230000'
      },
      tableIds: [fixture.tableId],
      source: 'ADMIN',
      depositRequired: true,
      deposit: {
        amountMinor: 5000,
        currency: 'USD',
        status
      }
    },
    context: { actorUserId: fixture.actorUserId }
  });
}

test('createDepositPaymentIntent throws a 404 DepositError when the reservation has no deposit', async () => {
  const reservation = await createReservation({
    organizationId: fixture.organizationId,
    payload: {
      venueId: fixture.venueId,
      reservationDate: futureSlot(4, 18),
      startAt: futureSlot(4, 18),
      durationMinutes: 90,
      partySize: 2,
      guest: {
        fullName: 'No Deposit Guest',
        email: `nodeposit-${Date.now()}@example.com`
      },
      tableIds: [fixture.tableId],
      source: 'ADMIN',
      depositRequired: false
    },
    context: { actorUserId: fixture.actorUserId }
  });

  await assert.rejects(
    () =>
      createDepositPaymentIntent({
        venueSlug: fixture.venueSlug,
        reservationId: reservation.id
      }),
    (error: unknown) => error instanceof DepositError && error.status === 404
  );
});

test('createDepositPaymentIntent throws a 409 DepositError when the deposit is already paid', async () => {
  const reservation = await createReservationWithDeposit('PAID');

  await assert.rejects(
    () =>
      createDepositPaymentIntent({
        venueSlug: fixture.venueSlug,
        reservationId: reservation.id
      }),
    (error: unknown) => error instanceof DepositError && error.status === 409
  );
});

test('createDepositPaymentIntent throws a 404 DepositError for a reservationId scoped to a different venue slug', async () => {
  const reservation = await createReservationWithDeposit('UNPAID');

  await assert.rejects(
    () =>
      createDepositPaymentIntent({
        venueSlug: 'some-other-venue-slug',
        reservationId: reservation.id
      }),
    (error: unknown) => error instanceof DepositError && error.status === 404
  );
});

test('markDepositPaidByPaymentIntent marks the matching deposit paid and sets paidAt', async () => {
  const reservation = await createReservationWithDeposit('UNPAID');
  await prisma.deposit.update({
    where: { reservationId: reservation.id },
    data: { provider: 'stripe', providerRef: 'pi_test_123' }
  });

  await markDepositPaidByPaymentIntent('pi_test_123');

  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { reservationId: reservation.id }
  });
  assert.equal(deposit.status, 'PAID');
  assert.ok(deposit.paidAt);
});

test('markDepositPaidByPaymentIntent is a no-op for an unrelated payment intent id', async () => {
  const reservation = await createReservationWithDeposit('UNPAID');
  await prisma.deposit.update({
    where: { reservationId: reservation.id },
    data: { provider: 'stripe', providerRef: 'pi_test_456' }
  });

  await markDepositPaidByPaymentIntent('pi_test_does_not_match');

  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { reservationId: reservation.id }
  });
  assert.equal(deposit.status, 'UNPAID');
});

test('markDepositFailedByPaymentIntent does not regress a deposit that is already paid', async () => {
  const reservation = await createReservationWithDeposit('PAID');
  await prisma.deposit.update({
    where: { reservationId: reservation.id },
    data: { provider: 'stripe', providerRef: 'pi_test_789' }
  });

  await markDepositFailedByPaymentIntent('pi_test_789');

  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { reservationId: reservation.id }
  });
  assert.equal(
    deposit.status,
    'PAID',
    'a late failure webhook must never downgrade an already-paid deposit'
  );
});
