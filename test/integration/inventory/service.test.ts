import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let createOrder: typeof import('@/server/orders/service').createOrder;
let addOrderLine: typeof import('@/server/orders/service').addOrderLine;
let updateOrderLine: typeof import('@/server/orders/service').updateOrderLine;
let removeOrderLine: typeof import('@/server/orders/service').removeOrderLine;
let cancelOrder: typeof import('@/server/orders/service').cancelOrder;
let OrderValidationError: typeof import('@/server/orders/errors').OrderValidationError;
let adjustMenuItemStock: typeof import('@/server/inventory/service').adjustMenuItemStock;
let listLowStockItems: typeof import('@/server/inventory/service').listLowStockItems;
let InventoryError: typeof import('@/server/inventory/errors').InventoryError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const ordersService = await import('@/server/orders/service');
  const ordersErrors = await import('@/server/orders/errors');
  const inventoryService = await import('@/server/inventory/service');
  const inventoryErrors = await import('@/server/inventory/errors');

  createOrder = ordersService.createOrder;
  addOrderLine = ordersService.addOrderLine;
  updateOrderLine = ordersService.updateOrderLine;
  removeOrderLine = ordersService.removeOrderLine;
  cancelOrder = ordersService.cancelOrder;
  OrderValidationError = ordersErrors.OrderValidationError;
  adjustMenuItemStock = inventoryService.adjustMenuItemStock;
  listLowStockItems = inventoryService.listLowStockItems;
  InventoryError = inventoryErrors.InventoryError;
});

after(async () => {
  await teardown();
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedVenueWithTrackedItem(stockQty = 5, lowStockThreshold = 1) {
  const suffix = uniqueSuffix();
  const organization = await prisma.organization.create({
    data: { name: 'Inventory Test Org', slug: `inventory-org-${suffix}` }
  });
  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Inventory Test Venue',
      slug: `inventory-venue-${suffix}`,
      timezone: 'UTC',
      isActive: true
    }
  });
  const category = await prisma.menuCategory.create({
    data: { venueId: venue.id, name: 'Mains', isActive: true }
  });
  const trackedItem = await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId: category.id,
      name: 'Steak',
      priceMinor: 2500,
      isActive: true,
      trackInventory: true,
      stockQty,
      lowStockThreshold
    }
  });
  const untrackedItem = await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId: category.id,
      name: 'Soda',
      priceMinor: 300,
      isActive: true
    }
  });

  return { venue, trackedItem, untrackedItem };
}

test('addOrderLine decrements stock for a tracked item and is a no-op for an untracked one', async () => {
  const { venue, trackedItem, untrackedItem } =
    await seedVenueWithTrackedItem(5);
  const order = await createOrder({ payload: { venueId: venue.id } });

  await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: trackedItem.id, quantity: 2 }
  });
  await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: untrackedItem.id, quantity: 10 }
  });

  const trackedAfter = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  const untrackedAfter = await prisma.menuItem.findUniqueOrThrow({
    where: { id: untrackedItem.id }
  });
  assert.equal(trackedAfter.stockQty, 3);
  assert.equal(untrackedAfter.stockQty, 0);
});

test('addOrderLine rejects when requested quantity exceeds stock', async () => {
  const { venue, trackedItem } = await seedVenueWithTrackedItem(1);
  const order = await createOrder({ payload: { venueId: venue.id } });

  await assert.rejects(
    () =>
      addOrderLine({
        orderId: order.id,
        payload: { menuItemId: trackedItem.id, quantity: 5 }
      }),
    (error: unknown) => error instanceof OrderValidationError
  );

  const afterFailedAttempt = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  assert.equal(
    afterFailedAttempt.stockQty,
    1,
    'a rejected reservation must not partially decrement stock'
  );
});

test('updateOrderLine quantity change adjusts reserved stock by the delta', async () => {
  const { venue, trackedItem } = await seedVenueWithTrackedItem(10);
  const order = await createOrder({ payload: { venueId: venue.id } });
  const withLine = await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: trackedItem.id, quantity: 2 }
  });
  const lineId = withLine.lines[0].id;

  await updateOrderLine({ lineId, payload: { quantity: 5 } });
  let after = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  assert.equal(after.stockQty, 5); // 10 - 5

  await updateOrderLine({ lineId, payload: { quantity: 1 } });
  after = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  assert.equal(after.stockQty, 9); // 10 - 1
});

test('removeOrderLine and cancelOrder release reserved stock', async () => {
  const { venue, trackedItem } = await seedVenueWithTrackedItem(10);
  const order = await createOrder({ payload: { venueId: venue.id } });
  const withLine = await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: trackedItem.id, quantity: 3 }
  });
  await removeOrderLine({ lineId: withLine.lines[0].id });

  const afterRemoval = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  assert.equal(afterRemoval.stockQty, 10);

  const secondOrder = await createOrder({ payload: { venueId: venue.id } });
  await addOrderLine({
    orderId: secondOrder.id,
    payload: { menuItemId: trackedItem.id, quantity: 4 }
  });
  await cancelOrder({ orderId: secondOrder.id });

  const afterCancel = await prisma.menuItem.findUniqueOrThrow({
    where: { id: trackedItem.id }
  });
  assert.equal(afterCancel.stockQty, 10);
});

test('adjustMenuItemStock restocks and rejects going below zero', async () => {
  const { trackedItem } = await seedVenueWithTrackedItem(5);

  const restocked = await adjustMenuItemStock({
    menuItemId: trackedItem.id,
    payload: { quantityDelta: 20 }
  });
  assert.equal(restocked.stockQty, 25);

  await assert.rejects(
    () =>
      adjustMenuItemStock({
        menuItemId: trackedItem.id,
        payload: { quantityDelta: -100 }
      }),
    (error: unknown) => error instanceof InventoryError
  );
});

test('adjustMenuItemStock rejects an item that does not track inventory', async () => {
  const { untrackedItem } = await seedVenueWithTrackedItem();

  await assert.rejects(
    () =>
      adjustMenuItemStock({
        menuItemId: untrackedItem.id,
        payload: { quantityDelta: 5 }
      }),
    (error: unknown) => error instanceof InventoryError && error.status === 409
  );
});

test('listLowStockItems returns only tracked items at or below their threshold', async () => {
  const { venue, trackedItem } = await seedVenueWithTrackedItem(1, 2);

  const lowStock = await listLowStockItems({ venueId: venue.id });
  assert.equal(lowStock.length, 1);
  assert.equal(lowStock[0].id, trackedItem.id);

  await adjustMenuItemStock({
    menuItemId: trackedItem.id,
    payload: { quantityDelta: 10 }
  });
  const afterRestock = await listLowStockItems({ venueId: venue.id });
  assert.equal(afterRestock.length, 0);
});
