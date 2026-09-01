import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let listOrders: typeof import('@/server/orders/service').listOrders;
let getOrder: typeof import('@/server/orders/service').getOrder;
let createOrder: typeof import('@/server/orders/service').createOrder;
let addOrderLine: typeof import('@/server/orders/service').addOrderLine;
let updateOrderLine: typeof import('@/server/orders/service').updateOrderLine;
let removeOrderLine: typeof import('@/server/orders/service').removeOrderLine;
let closeOrder: typeof import('@/server/orders/service').closeOrder;
let cancelOrder: typeof import('@/server/orders/service').cancelOrder;
let computeOrderTotalMinor: typeof import('@/server/orders/service').computeOrderTotalMinor;
let OrderValidationError: typeof import('@/server/orders/errors').OrderValidationError;
let OrderNotFoundError: typeof import('@/server/orders/errors').OrderNotFoundError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/orders/service');
  const errors = await import('@/server/orders/errors');

  listOrders = service.listOrders;
  getOrder = service.getOrder;
  createOrder = service.createOrder;
  addOrderLine = service.addOrderLine;
  updateOrderLine = service.updateOrderLine;
  removeOrderLine = service.removeOrderLine;
  closeOrder = service.closeOrder;
  cancelOrder = service.cancelOrder;
  computeOrderTotalMinor = service.computeOrderTotalMinor;
  OrderValidationError = errors.OrderValidationError;
  OrderNotFoundError = errors.OrderNotFoundError;
});

after(async () => {
  await teardown();
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedVenueWithTableAndMenu() {
  const suffix = uniqueSuffix();
  const organization = await prisma.organization.create({
    data: { name: 'Orders Test Org', slug: `orders-org-${suffix}` }
  });
  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Orders Test Venue',
      slug: `orders-venue-${suffix}`,
      timezone: 'UTC',
      isActive: true
    }
  });
  const area = await prisma.area.create({
    data: { venueId: venue.id, name: 'Main Room', isActive: true }
  });
  const table = await prisma.table.create({
    data: {
      venueId: venue.id,
      areaId: area.id,
      name: 'T1',
      capacityMax: 4,
      isActive: true
    }
  });
  const category = await prisma.menuCategory.create({
    data: { venueId: venue.id, name: 'Mains', isActive: true }
  });
  const menuItem = await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId: category.id,
      name: 'Burger',
      priceMinor: 1250,
      isActive: true
    }
  });
  const inactiveMenuItem = await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId: category.id,
      name: 'Discontinued',
      priceMinor: 999,
      isActive: false
    }
  });

  return {
    organization,
    venue,
    area,
    table,
    category,
    menuItem,
    inactiveMenuItem
  };
}

test('createOrder against a table, then addOrderLine snapshots name/price', async () => {
  const { venue, table, menuItem } = await seedVenueWithTableAndMenu();

  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  assert.equal(order.status, 'OPEN');
  assert.equal(order.tableId, table.id);

  const withLine = await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: menuItem.id, quantity: 2 }
  });

  assert.equal(withLine.lines.length, 1);
  assert.equal(withLine.lines[0].nameSnapshot, 'Burger');
  assert.equal(withLine.lines[0].priceMinorSnapshot, 1250);
  assert.equal(withLine.lines[0].quantity, 2);
  assert.equal(computeOrderTotalMinor(withLine.lines), 2500);
});

test('createOrder rejects a table from a different venue', async () => {
  const venueA = await seedVenueWithTableAndMenu();
  const venueB = await seedVenueWithTableAndMenu();

  await assert.rejects(
    () =>
      createOrder({
        payload: { venueId: venueB.venue.id, tableId: venueA.table.id }
      }),
    (error: unknown) => error instanceof OrderValidationError
  );
});

test('createOrder rejects a reservation from a different venue', async () => {
  const venueA = await seedVenueWithTableAndMenu();
  const venueB = await seedVenueWithTableAndMenu();
  const statusOnA = await prisma.reservationStatus.create({
    data: {
      organizationId: venueA.organization.id,
      code: 'PENDING',
      label: 'Pending',
      isDefault: true
    }
  });
  const guestOnA = await prisma.guest.create({
    data: { organizationId: venueA.organization.id, fullName: 'Guest' }
  });
  const reservationOnA = await prisma.reservation.create({
    data: {
      organizationId: venueA.organization.id,
      venueId: venueA.venue.id,
      guestId: guestOnA.id,
      reservationStatusId: statusOnA.id,
      reservationDate: new Date(),
      startAt: new Date(),
      endAt: new Date(Date.now() + 60 * 60_000),
      partySize: 2
    }
  });

  await assert.rejects(
    () =>
      createOrder({
        payload: { venueId: venueB.venue.id, reservationId: reservationOnA.id }
      }),
    (error: unknown) => error instanceof OrderValidationError
  );
});

test('addOrderLine rejects an inactive menu item', async () => {
  const { venue, table, inactiveMenuItem } = await seedVenueWithTableAndMenu();
  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });

  await assert.rejects(
    () =>
      addOrderLine({
        orderId: order.id,
        payload: { menuItemId: inactiveMenuItem.id }
      }),
    (error: unknown) => error instanceof OrderValidationError
  );
});

test('updateOrderLine changes quantity and removeOrderLine removes it', async () => {
  const { venue, table, menuItem } = await seedVenueWithTableAndMenu();
  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  const withLine = await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: menuItem.id, quantity: 1 }
  });
  const lineId = withLine.lines[0].id;

  const updated = await updateOrderLine({ lineId, payload: { quantity: 3 } });
  assert.equal(updated.lines[0].quantity, 3);
  assert.equal(computeOrderTotalMinor(updated.lines), 3750);

  const afterRemoval = await removeOrderLine({ lineId });
  assert.equal(afterRemoval.lines.length, 0);
});

test('addOrderLine defaults kitchenStatus to PENDING; updateOrderLine bumps it to READY and back', async () => {
  const { venue, table, menuItem } = await seedVenueWithTableAndMenu();
  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  const withLine = await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: menuItem.id, quantity: 1 }
  });
  const lineId = withLine.lines[0].id;
  assert.equal(withLine.lines[0].kitchenStatus, 'PENDING');

  const bumped = await updateOrderLine({
    lineId,
    payload: { kitchenStatus: 'READY' }
  });
  assert.equal(bumped.lines[0].kitchenStatus, 'READY');
  assert.equal(bumped.lines[0].quantity, 1, 'bumping status must not touch quantity');

  const unbumped = await updateOrderLine({
    lineId,
    payload: { kitchenStatus: 'PENDING' }
  });
  assert.equal(unbumped.lines[0].kitchenStatus, 'PENDING');
});

test('closeOrder transitions status and blocks further line changes', async () => {
  const { venue, table, menuItem } = await seedVenueWithTableAndMenu();
  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: menuItem.id }
  });

  const closed = await closeOrder({ orderId: order.id });
  assert.equal(closed.status, 'CLOSED');
  assert.ok(closed.closedAt);

  await assert.rejects(
    () =>
      addOrderLine({ orderId: order.id, payload: { menuItemId: menuItem.id } }),
    (error: unknown) => error instanceof OrderValidationError
  );

  await assert.rejects(
    () => closeOrder({ orderId: order.id }),
    (error: unknown) => error instanceof OrderValidationError
  );
});

test('cancelOrder transitions status to CANCELLED', async () => {
  const { venue, table } = await seedVenueWithTableAndMenu();
  const order = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });

  const cancelled = await cancelOrder({ orderId: order.id });
  assert.equal(cancelled.status, 'CANCELLED');
});

test('listOrders filters by status', async () => {
  const { venue, table } = await seedVenueWithTableAndMenu();
  const openOrder = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  const orderToClose = await createOrder({
    payload: { venueId: venue.id, tableId: table.id }
  });
  await closeOrder({ orderId: orderToClose.id });

  const openOnly = await listOrders({ venueId: venue.id, status: 'OPEN' });
  assert.equal(openOnly.length, 1);
  assert.equal(openOnly[0].id, openOrder.id);

  const closedOnly = await listOrders({ venueId: venue.id, status: 'CLOSED' });
  assert.equal(closedOnly.length, 1);
  assert.equal(closedOnly[0].id, orderToClose.id);
});

test('getOrder on an unknown id throws OrderNotFoundError', async () => {
  await assert.rejects(
    () => getOrder({ orderId: 'cnonexistentorderid000001' }),
    (error: unknown) => error instanceof OrderNotFoundError
  );
});
