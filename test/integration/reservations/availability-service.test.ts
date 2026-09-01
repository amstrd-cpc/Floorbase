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

let listAvailableTables: typeof import('@/server/reservations/availability-service').listAvailableTables;
let listAvailableSlots: typeof import('@/server/reservations/availability-service').listAvailableSlots;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/reservations/availability-service');
  listAvailableTables = service.listAvailableTables;
  listAvailableSlots = service.listAvailableSlots;
});

after(async () => {
  await teardown();
});

beforeEach(async () => {
  await resetReservationData(prisma);
  fixture = await seedFixture(prisma);
});

// Fixture venue's timezone is UTC, so zoned minutes == UTC minutes and we
// can work in plain UTC dates without any offset math.
function findWeekdayOnOrAfter(start: Date, targetWeekday: number) {
  const date = new Date(start);
  while (date.getUTCDay() !== targetWeekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

function atUtc(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function setOvernightHours(mondayWeekday: number, tuesdayWeekday: number) {
  // 18:00 open, 02:00 close - closes after midnight into Tuesday.
  await prisma.businessHours.update({
    where: {
      venueId_dayOfWeek: { venueId: fixture.venueId, dayOfWeek: mondayWeekday }
    },
    data: { openTime: '18:00', closeTime: '02:00', isClosed: false }
  });
  // Tuesday itself is closed (a distinct day, deliberately not open-all-day
  // like the fixture default) so a match against Tuesday's own row would
  // fail - proving the post-midnight slot is validated against Monday's
  // overnight row, not silently passing because Tuesday also happens to be
  // open.
  await prisma.businessHours.update({
    where: {
      venueId_dayOfWeek: { venueId: fixture.venueId, dayOfWeek: tuesdayWeekday }
    },
    data: { isClosed: true }
  });
}

test('same-day evening reservation validates under overnight hours (18:00-02:00)', async () => {
  const monday = findWeekdayOnOrAfter(new Date('2026-01-01T00:00:00Z'), 1);
  await setOvernightHours(1, 2);

  const result = await listAvailableTables({
    organizationId: fixture.organizationId,
    venueId: fixture.venueId,
    startAt: atUtc(monday, 19, 0),
    durationMinutes: 90,
    partySize: 2
  });

  assert.equal(result.allowed, true);
});

test('post-midnight reservation validates against the previous day\'s overnight hours', async () => {
  const monday = findWeekdayOnOrAfter(new Date('2026-01-01T00:00:00Z'), 1);
  const tuesday = new Date(monday);
  tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  await setOvernightHours(1, 2);

  const result = await listAvailableTables({
    organizationId: fixture.organizationId,
    venueId: fixture.venueId,
    startAt: atUtc(tuesday, 0, 30),
    durationMinutes: 60, // ends 01:30, still before Monday's 02:00 close
    partySize: 2
  });

  assert.equal(result.allowed, true);
});

test('a reservation past the overnight close time is rejected', async () => {
  const monday = findWeekdayOnOrAfter(new Date('2026-01-01T00:00:00Z'), 1);
  const tuesday = new Date(monday);
  tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  await setOvernightHours(1, 2);

  const result = await listAvailableTables({
    organizationId: fixture.organizationId,
    venueId: fixture.venueId,
    startAt: atUtc(tuesday, 1, 30),
    durationMinutes: 60, // would end 02:30, past the 02:00 close
    partySize: 2
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'OUTSIDE_BUSINESS_HOURS');
});

test('a reservation before the overnight open time is rejected', async () => {
  const monday = findWeekdayOnOrAfter(new Date('2026-01-01T00:00:00Z'), 1);
  await setOvernightHours(1, 2);

  const result = await listAvailableTables({
    organizationId: fixture.organizationId,
    venueId: fixture.venueId,
    startAt: atUtc(monday, 16, 0), // before the 18:00 open
    durationMinutes: 90,
    partySize: 2
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'OUTSIDE_BUSINESS_HOURS');
});

test('listAvailableSlots generates slots spanning past midnight for overnight hours', async () => {
  const monday = findWeekdayOnOrAfter(new Date('2026-01-01T00:00:00Z'), 1);
  await setOvernightHours(1, 2);

  const slots = await listAvailableSlots({
    organizationId: fixture.organizationId,
    venueId: fixture.venueId,
    date: monday,
    partySize: 2,
    durationMinutes: 60
  });

  assert.ok(slots.length > 0, 'must generate at least one slot');
  const lastSlot = slots[slots.length - 1];
  // 60-minute slots from 18:00 up to a 02:00 close - the last slot must
  // start after midnight (on Tuesday), proving generation crossed the day
  // boundary instead of stopping dead at Monday 23:xx.
  assert.ok(
    lastSlot.startAt.getTime() >= atUtc(monday, 24, 0).getTime(),
    `expected the last generated slot to start after midnight, got ${lastSlot.startAt.toISOString()}`
  );
});
