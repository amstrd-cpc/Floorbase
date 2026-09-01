import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let listStaff: typeof import('@/server/staff/service').listStaff;
let createStaffMember: typeof import('@/server/staff/service').createStaffMember;
let updateStaffMember: typeof import('@/server/staff/service').updateStaffMember;
let clockIn: typeof import('@/server/staff/service').clockIn;
let clockOut: typeof import('@/server/staff/service').clockOut;
let listShifts: typeof import('@/server/staff/service').listShifts;
let StaffValidationError: typeof import('@/server/staff/errors').StaffValidationError;
let StaffNotFoundError: typeof import('@/server/staff/errors').StaffNotFoundError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/staff/service');
  const errors = await import('@/server/staff/errors');

  listStaff = service.listStaff;
  createStaffMember = service.createStaffMember;
  updateStaffMember = service.updateStaffMember;
  clockIn = service.clockIn;
  clockOut = service.clockOut;
  listShifts = service.listShifts;
  StaffValidationError = errors.StaffValidationError;
  StaffNotFoundError = errors.StaffNotFoundError;
});

after(async () => {
  await teardown();
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedVenue() {
  const suffix = uniqueSuffix();
  const organization = await prisma.organization.create({
    data: { name: 'Staff Test Org', slug: `staff-org-${suffix}` }
  });
  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Staff Test Venue',
      slug: `staff-venue-${suffix}`,
      timezone: 'UTC',
      isActive: true
    }
  });
  return { organization, venue };
}

test('createStaffMember never returns the pinHash, and listStaff reflects it', async () => {
  const { venue } = await seedVenue();

  const created = await createStaffMember({
    venueId: venue.id,
    name: 'Alex Server',
    pin: '1234'
  });
  assert.ok(!('pinHash' in created));

  const list = await listStaff({ venueId: venue.id });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Alex Server');
  assert.ok(!('pinHash' in list[0]));
});

test('createStaffMember rejects an invalid PIN', async () => {
  const { venue } = await seedVenue();

  await assert.rejects(
    () => createStaffMember({ venueId: venue.id, name: 'Bad Pin', pin: '12' }),
    (error: unknown) => error instanceof StaffValidationError
  );
});

test('updateStaffMember can rename, deactivate, and reset the PIN', async () => {
  const { venue } = await seedVenue();
  const staffMember = await createStaffMember({
    venueId: venue.id,
    name: 'Jordan Cook',
    pin: '1111'
  });

  const renamed = await updateStaffMember({
    staffMemberId: staffMember.id,
    payload: { name: 'Jordan C.' }
  });
  assert.equal(renamed.name, 'Jordan C.');
  assert.equal(renamed.isActive, true);

  const deactivated = await updateStaffMember({
    staffMemberId: staffMember.id,
    payload: { isActive: false }
  });
  assert.equal(deactivated.isActive, false);

  // Reset the PIN, then reactivate and confirm the new PIN clocks in.
  await updateStaffMember({
    staffMemberId: staffMember.id,
    payload: { isActive: true, pin: '9999' }
  });
  const shift = await clockIn({
    staffMemberId: staffMember.id,
    payload: { pin: '9999' }
  });
  assert.ok(shift.id);
});

test('clockIn rejects an incorrect PIN and an inactive staff member', async () => {
  const { venue } = await seedVenue();
  const staffMember = await createStaffMember({
    venueId: venue.id,
    name: 'Sam Bartender',
    pin: '2468'
  });

  await assert.rejects(
    () => clockIn({ staffMemberId: staffMember.id, payload: { pin: '0000' } }),
    (error: unknown) => error instanceof StaffValidationError
  );

  await updateStaffMember({
    staffMemberId: staffMember.id,
    payload: { isActive: false }
  });
  await assert.rejects(
    () => clockIn({ staffMemberId: staffMember.id, payload: { pin: '2468' } }),
    (error: unknown) => error instanceof StaffValidationError
  );
});

test('clockIn rejects a double clock-in, and clockOut requires an open shift', async () => {
  const { venue } = await seedVenue();
  const staffMember = await createStaffMember({
    venueId: venue.id,
    name: 'Riley Host',
    pin: '3141'
  });

  await clockIn({ staffMemberId: staffMember.id, payload: { pin: '3141' } });

  await assert.rejects(
    () => clockIn({ staffMemberId: staffMember.id, payload: { pin: '3141' } }),
    (error: unknown) => error instanceof StaffValidationError
  );

  const closed = await clockOut({
    staffMemberId: staffMember.id,
    payload: { pin: '3141' }
  });
  assert.ok(closed.clockOutAt);

  await assert.rejects(
    () => clockOut({ staffMemberId: staffMember.id, payload: { pin: '3141' } }),
    (error: unknown) => error instanceof StaffValidationError
  );
});

test('clockIn/clockOut throw StaffNotFoundError for an unknown staff member', async () => {
  await assert.rejects(
    () =>
      clockIn({
        staffMemberId: 'cnonexistentstaffid00001',
        payload: { pin: '1234' }
      }),
    (error: unknown) => error instanceof StaffNotFoundError
  );
});

test('listShifts filters to active-only and reflects clock-in/out', async () => {
  const { venue } = await seedVenue();
  const staffMember = await createStaffMember({
    venueId: venue.id,
    name: 'Casey Runner',
    pin: '5678'
  });

  await clockIn({ staffMemberId: staffMember.id, payload: { pin: '5678' } });

  const active = await listShifts({ venueId: venue.id, activeOnly: true });
  assert.equal(active.length, 1);
  assert.equal(active[0].staffMember.name, 'Casey Runner');

  await clockOut({ staffMemberId: staffMember.id, payload: { pin: '5678' } });

  const activeAfter = await listShifts({ venueId: venue.id, activeOnly: true });
  assert.equal(activeAfter.length, 0);

  const all = await listShifts({ venueId: venue.id });
  assert.equal(all.length, 1);
  assert.ok(all[0].clockOutAt);
});
