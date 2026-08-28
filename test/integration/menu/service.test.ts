import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let listMenu: typeof import('@/server/menu/service').listMenu;
let createMenuCategory: typeof import('@/server/menu/service').createMenuCategory;
let updateMenuCategory: typeof import('@/server/menu/service').updateMenuCategory;
let deleteMenuCategory: typeof import('@/server/menu/service').deleteMenuCategory;
let createMenuItem: typeof import('@/server/menu/service').createMenuItem;
let updateMenuItem: typeof import('@/server/menu/service').updateMenuItem;
let deleteMenuItem: typeof import('@/server/menu/service').deleteMenuItem;
let MenuValidationError: typeof import('@/server/menu/errors').MenuValidationError;
let MenuNotFoundError: typeof import('@/server/menu/errors').MenuNotFoundError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/menu/service');
  const errors = await import('@/server/menu/errors');

  listMenu = service.listMenu;
  createMenuCategory = service.createMenuCategory;
  updateMenuCategory = service.updateMenuCategory;
  deleteMenuCategory = service.deleteMenuCategory;
  createMenuItem = service.createMenuItem;
  updateMenuItem = service.updateMenuItem;
  deleteMenuItem = service.deleteMenuItem;
  MenuValidationError = errors.MenuValidationError;
  MenuNotFoundError = errors.MenuNotFoundError;
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
    data: { name: 'Menu Test Org', slug: `menu-org-${suffix}` }
  });
  return prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Menu Test Venue',
      slug: `menu-venue-${suffix}`,
      timezone: 'UTC',
      isActive: true
    }
  });
}

test('createMenuCategory then createMenuItem builds a listable catalog', async () => {
  const venue = await seedVenue();

  const category = await createMenuCategory({ venueId: venue.id, name: 'Mains' });
  const item = await createMenuItem({
    venueId: venue.id,
    categoryId: category.id,
    name: 'Burger',
    priceMinor: 1250
  });

  const categories = await listMenu({ venueId: venue.id });
  assert.equal(categories.length, 1);
  assert.equal(categories[0].id, category.id);
  assert.equal(categories[0].items.length, 1);
  assert.equal(categories[0].items[0].id, item.id);
  assert.equal(categories[0].items[0].priceMinor, 1250);
});

test('createMenuCategory rejects a duplicate name in the same venue', async () => {
  const venue = await seedVenue();
  await createMenuCategory({ venueId: venue.id, name: 'Drinks' });

  await assert.rejects(
    () => createMenuCategory({ venueId: venue.id, name: 'Drinks' }),
    (error: unknown) => error instanceof MenuValidationError
  );
});

test('createMenuItem rejects a category from a different venue', async () => {
  const venueA = await seedVenue();
  const venueB = await seedVenue();
  const categoryOnA = await createMenuCategory({ venueId: venueA.id, name: 'Starters' });

  await assert.rejects(
    () =>
      createMenuItem({
        venueId: venueB.id,
        categoryId: categoryOnA.id,
        name: 'Soup',
        priceMinor: 500
      }),
    (error: unknown) => error instanceof MenuValidationError
  );
});

test('updateMenuItem moves an item between categories in the same venue', async () => {
  const venue = await seedVenue();
  const mains = await createMenuCategory({ venueId: venue.id, name: 'Mains' });
  const desserts = await createMenuCategory({ venueId: venue.id, name: 'Desserts' });
  const item = await createMenuItem({
    venueId: venue.id,
    categoryId: mains.id,
    name: 'Cake',
    priceMinor: 800
  });

  const updated = await updateMenuItem({
    itemId: item.id,
    payload: { categoryId: desserts.id }
  });

  assert.equal(updated.categoryId, desserts.id);
});

test('updateMenuItem rejects moving an item to a category from a different venue', async () => {
  const venueA = await seedVenue();
  const venueB = await seedVenue();
  const categoryOnA = await createMenuCategory({ venueId: venueA.id, name: 'Mains' });
  const categoryOnB = await createMenuCategory({ venueId: venueB.id, name: 'Mains' });
  const item = await createMenuItem({
    venueId: venueA.id,
    categoryId: categoryOnA.id,
    name: 'Steak',
    priceMinor: 2500
  });

  await assert.rejects(
    () => updateMenuItem({ itemId: item.id, payload: { categoryId: categoryOnB.id } }),
    (error: unknown) => error instanceof MenuValidationError
  );
});

test('deleteMenuCategory cascades to its items', async () => {
  const venue = await seedVenue();
  const category = await createMenuCategory({ venueId: venue.id, name: 'Sides' });
  const item = await createMenuItem({
    venueId: venue.id,
    categoryId: category.id,
    name: 'Fries',
    priceMinor: 400
  });

  await deleteMenuCategory({ categoryId: category.id });

  const found = await prisma.menuItem.findUnique({ where: { id: item.id } });
  assert.equal(found, null);
});

test('deleteMenuItem on an unknown id throws MenuNotFoundError', async () => {
  await assert.rejects(
    () => deleteMenuItem({ itemId: 'cnonexistentitemid00000001' }),
    (error: unknown) => error instanceof MenuNotFoundError
  );
});

test('updateMenuCategory on an unknown id throws MenuNotFoundError', async () => {
  await assert.rejects(
    () => updateMenuCategory({ categoryId: 'cnonexistentcategoryid001', payload: { name: 'X' } }),
    (error: unknown) => error instanceof MenuNotFoundError
  );
});
