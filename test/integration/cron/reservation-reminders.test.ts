import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import {
  setupTestDatabase,
  seedFixture,
  resetReservationData,
  type TestFixture
} from '@/server/db/testing/test-db';

const CRON_SECRET = 'test-cron-secret-0123456789';

let prisma: PrismaClient;
let teardown: () => Promise<void>;
let fixture: TestFixture;
let createReservation: typeof import('@/server/reservations/service').createReservation;
let GET: typeof import('@/app/api/cron/reservation-reminders/route').GET;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;
  process.env.AUTH_SESSION_SECRET ??= 'kQ7z2XpL9mR4vB8nT1yC6wF3hJ0sA5dE';
  process.env.CRON_SECRET = CRON_SECRET;
  delete process.env.RESEND_API_KEY;

  const reservationService = await import('@/server/reservations/service');
  const route = await import('@/app/api/cron/reservation-reminders/route');
  createReservation = reservationService.createReservation;
  GET = route.GET;
});

after(async () => {
  await teardown();
});

beforeEach(async () => {
  await resetReservationData(prisma);
  fixture = await seedFixture(prisma);
});

function futureSlot(hoursAhead: number) {
  const date = new Date();
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + hoursAhead);
  return date;
}

function callCron(authHeader?: string) {
  return GET(
    new Request('http://localhost/api/cron/reservation-reminders', {
      headers: authHeader ? { authorization: authHeader } : undefined
    })
  );
}

async function createReservationAt(
  startAt: Date,
  overrides: { withEmail?: boolean } = {}
) {
  const withEmail = overrides.withEmail ?? true;
  return createReservation({
    organizationId: fixture.organizationId,
    payload: {
      venueId: fixture.venueId,
      reservationDate: startAt,
      startAt,
      durationMinutes: 90,
      partySize: 2,
      guest: {
        fullName: 'Reminder Guest',
        email: withEmail
          ? `reminder-${Date.now()}-${Math.random()}@example.com`
          : null,
        phone: withEmail ? undefined : '+15551230000'
      },
      tableIds: [fixture.tableId],
      source: 'ADMIN',
      depositRequired: false
    },
    context: { actorUserId: fixture.actorUserId }
  });
}

test('rejects requests without the correct CRON_SECRET bearer token', async () => {
  const res = await callCron('Bearer wrong-secret');
  assert.equal(res.status, 401);
});

test('rejects requests with no authorization header', async () => {
  const res = await callCron();
  assert.equal(res.status, 401);
});

test('sends a reminder for a reservation inside the 24h window and logs it', async () => {
  const reservation = await createReservationAt(futureSlot(6));

  const res = await callCron(`Bearer ${CRON_SECRET}`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.sent, 1);

  const log = await prisma.notificationLog.findFirstOrThrow({
    where: {
      reservationId: reservation.id,
      templateKey: 'reservation_reminder'
    }
  });
  assert.equal(log.status, 'SKIPPED'); // no RESEND_API_KEY in this test env
});

test('retries a reservation whose only previous attempt was SKIPPED/FAILED', async () => {
  // No RESEND_API_KEY in this test env, so every real attempt logs SKIPPED,
  // never SENT - which is exactly the scenario the dedup filter must not
  // treat as "done". A stale FAILED (e.g. a Resend outage) must not
  // permanently exclude the reservation from every later cron run either.
  await createReservationAt(futureSlot(6));

  const first = await callCron(`Bearer ${CRON_SECRET}`);
  assert.equal((await first.json()).sent, 1);

  const second = await callCron(`Bearer ${CRON_SECRET}`);
  assert.equal(
    (await second.json()).sent,
    1,
    'a SKIPPED (or FAILED) prior attempt must be retried, not permanently excluded'
  );
});

test('does not re-send a reminder once one attempt actually SENT', async () => {
  const reservation = await createReservationAt(futureSlot(6));
  await prisma.notificationLog.create({
    data: {
      organizationId: fixture.organizationId,
      reservationId: reservation.id,
      templateKey: 'reservation_reminder',
      channel: 'EMAIL',
      recipient: 'guest@example.com',
      status: 'SENT'
    }
  });

  const res = await callCron(`Bearer ${CRON_SECRET}`);
  assert.equal(
    (await res.json()).sent,
    0,
    'a SENT reminder must exclude the reservation from further attempts'
  );
});

test('ignores reservations outside the 24h reminder window', async () => {
  await createReservationAt(futureSlot(48));

  const res = await callCron(`Bearer ${CRON_SECRET}`);
  const body = await res.json();
  assert.equal(body.checked, 0);
});

test('ignores cancelled reservations', async () => {
  const reservation = await createReservationAt(futureSlot(6));
  const cancelledStatusId = fixture.cancelledStatusId;
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { bookingStatus: 'CANCELLED', reservationStatusId: cancelledStatusId }
  });

  const res = await callCron(`Bearer ${CRON_SECRET}`);
  const body = await res.json();
  assert.equal(body.checked, 0);
});

test('skips reservations whose guest has no email, without erroring', async () => {
  await createReservationAt(futureSlot(6), { withEmail: false });

  const res = await callCron(`Bearer ${CRON_SECRET}`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.sent, 0);
});
