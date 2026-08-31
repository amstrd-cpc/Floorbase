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
let sendGuestConfirmation: typeof import('@/server/email/service').sendGuestConfirmation;
let sendVenueNewReservationAlert: typeof import('@/server/email/service').sendVenueNewReservationAlert;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;
  process.env.AUTH_SESSION_SECRET ??= 'kQ7z2XpL9mR4vB8nT1yC6wF3hJ0sA5dE';
  // No RESEND_API_KEY in this test env, so every send below takes the
  // "resend not configured" branch — deterministic, no network involved.
  delete process.env.RESEND_API_KEY;

  const reservationService = await import('@/server/reservations/service');
  const emailService = await import('@/server/email/service');
  createReservation = reservationService.createReservation;
  sendGuestConfirmation = emailService.sendGuestConfirmation;
  sendVenueNewReservationAlert = emailService.sendVenueNewReservationAlert;
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

async function createTestReservation() {
  const startAt = futureSlot(3, 18);
  return createReservation({
    organizationId: fixture.organizationId,
    payload: {
      venueId: fixture.venueId,
      reservationDate: startAt,
      startAt,
      durationMinutes: 90,
      partySize: 2,
      guest: {
        fullName: 'Notify Guest',
        email: `notify-${Date.now()}@example.com`
      },
      tableIds: [fixture.tableId],
      source: 'ADMIN',
      depositRequired: false
    },
    context: { actorUserId: fixture.actorUserId }
  });
}

test('sendGuestConfirmation writes a SKIPPED NotificationLog row when email sending is unconfigured', async () => {
  const reservation = await createTestReservation();

  await sendGuestConfirmation({
    to: 'guest@example.com',
    guestName: 'Guest Person',
    venueName: 'Test Venue',
    startAt: reservation.startAt,
    timezone: 'UTC',
    partySize: 2,
    statusCode: 'CONFIRMED',
    reservationId: reservation.id,
    organizationId: fixture.organizationId,
    guestId: reservation.guestId
  });

  const log = await prisma.notificationLog.findFirstOrThrow({
    where: { reservationId: reservation.id, templateKey: 'guest_confirmation' }
  });
  assert.equal(log.status, 'SKIPPED');
  assert.equal(log.channel, 'EMAIL');
  assert.equal(log.recipient, 'guest@example.com');
  assert.equal(log.guestId, reservation.guestId);
  assert.equal(log.sentAt, null);
});

test('sendVenueNewReservationAlert writes a SKIPPED NotificationLog row', async () => {
  const reservation = await createTestReservation();

  await sendVenueNewReservationAlert({
    to: 'owner@example.com',
    venueName: 'Test Venue',
    guestName: 'Notify Guest',
    guestEmail: null,
    guestPhone: null,
    startAt: reservation.startAt,
    timezone: 'UTC',
    partySize: 2,
    source: 'Admin',
    appUrl: 'http://localhost:3000',
    reservationId: reservation.id,
    organizationId: fixture.organizationId,
    guestId: reservation.guestId
  });

  const log = await prisma.notificationLog.findFirstOrThrow({
    where: {
      reservationId: reservation.id,
      templateKey: 'venue_new_reservation_alert'
    }
  });
  assert.equal(log.status, 'SKIPPED');
  assert.equal(log.recipient, 'owner@example.com');
});
