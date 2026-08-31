import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let getOrCreateDraftLayout: typeof import('@/server/floor-layout/service').getOrCreateDraftLayout;
let saveDraftLayout: typeof import('@/server/floor-layout/service').saveDraftLayout;
let publishDraftLayout: typeof import('@/server/floor-layout/service').publishDraftLayout;
let getPublishedLayout: typeof import('@/server/floor-layout/service').getPublishedLayout;
let FloorValidationError: typeof import('@/server/floor/errors').FloorValidationError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  const service = await import('@/server/floor-layout/service');
  const errors = await import('@/server/floor/errors');

  getOrCreateDraftLayout = service.getOrCreateDraftLayout;
  saveDraftLayout = service.saveDraftLayout;
  publishDraftLayout = service.publishDraftLayout;
  getPublishedLayout = service.getPublishedLayout;
  FloorValidationError = errors.FloorValidationError;
});

after(async () => {
  await teardown();
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedVenueWithTables() {
  const suffix = uniqueSuffix();
  const organization = await prisma.organization.create({
    data: { name: 'Floor Test Org', slug: `floor-org-${suffix}` }
  });
  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Floor Test Venue',
      slug: `floor-venue-${suffix}`,
      timezone: 'UTC',
      isActive: true
    }
  });
  const areaA = await prisma.area.create({
    data: { venueId: venue.id, name: 'Main Room', sortOrder: 0, isActive: true }
  });
  const areaB = await prisma.area.create({
    data: { venueId: venue.id, name: 'Patio', sortOrder: 1, isActive: true }
  });
  const tableA = await prisma.table.create({
    data: {
      venueId: venue.id,
      areaId: areaA.id,
      name: 'A1',
      capacityMax: 4,
      isActive: true
    }
  });
  const tableB = await prisma.table.create({
    data: {
      venueId: venue.id,
      areaId: areaB.id,
      name: 'B1',
      capacityMax: 2,
      isActive: true
    }
  });
  return { venue, areaA, areaB, tableA, tableB };
}

test('getOrCreateDraftLayout seeds a draft from existing areas/tables and is idempotent', async () => {
  const { venue } = await seedVenueWithTables();

  const draft = await getOrCreateDraftLayout(venue.id);
  assert.equal(draft.status, 'DRAFT');
  assert.deepEqual(draft.areas.map((area) => area.name).sort(), [
    'Main Room',
    'Patio'
  ]);
  assert.equal(draft.tables.length, 2);

  const draftAgain = await getOrCreateDraftLayout(venue.id);
  assert.equal(
    draftAgain.id,
    draft.id,
    'a second call must reuse the same draft, not create another one'
  );
});

test('saveDraftLayout persists position changes', async () => {
  const { venue } = await seedVenueWithTables();
  const draft = await getOrCreateDraftLayout(venue.id);
  const movedTable = draft.tables[0];

  const saved = await saveDraftLayout({
    venueId: venue.id,
    canvasWidth: draft.canvasWidth,
    canvasHeight: draft.canvasHeight,
    gridSize: draft.gridSize,
    areas: draft.areas,
    tables: draft.tables.map((table) =>
      table.id === movedTable.id
        ? { ...table, x: 777, y: 333, rotation: 90 }
        : table
    )
  });

  const movedSaved = saved.tables.find((table) => table.id === movedTable.id);
  assert.ok(movedSaved);
  assert.equal(movedSaved.x, 777);
  assert.equal(movedSaved.y, 333);
  assert.equal(movedSaved.rotation, 90);
});

test('saveDraftLayout rejects table IDs outside the venue scope', async () => {
  const { venue } = await seedVenueWithTables();
  const draft = await getOrCreateDraftLayout(venue.id);

  await assert.rejects(
    () =>
      saveDraftLayout({
        venueId: venue.id,
        canvasWidth: draft.canvasWidth,
        canvasHeight: draft.canvasHeight,
        gridSize: draft.gridSize,
        areas: draft.areas,
        tables: [{ ...draft.tables[0], tableId: 'cforeigntableidoutsidescope' }]
      }),
    (error: unknown) => error instanceof FloorValidationError
  );
});

test('publishDraftLayout maps each table to its own area, not by array position', async () => {
  const { venue, areaA, areaB, tableA, tableB } = await seedVenueWithTables();
  await getOrCreateDraftLayout(venue.id);

  const published = await publishDraftLayout(venue.id);
  assert.ok(published);

  const publishedTableA = published.tables.find(
    (table) => table.tableId === tableA.id
  );
  const publishedTableB = published.tables.find(
    (table) => table.tableId === tableB.id
  );
  assert.ok(publishedTableA && publishedTableB);

  const areaForTableA = published.areas.find(
    (area) => area.id === publishedTableA.floorLayoutAreaId
  );
  const areaForTableB = published.areas.find(
    (area) => area.id === publishedTableB.floorLayoutAreaId
  );

  assert.equal(
    areaForTableA?.areaId,
    areaA.id,
    'table A must stay linked to area A after publish'
  );
  assert.equal(
    areaForTableB?.areaId,
    areaB.id,
    'table B must stay linked to area B after publish'
  );
});

test('publishDraftLayout archives the previous published version and bumps the version number', async () => {
  const { venue } = await seedVenueWithTables();
  await getOrCreateDraftLayout(venue.id);

  const firstPublished = await publishDraftLayout(venue.id);
  assert.equal(firstPublished?.version, 1);

  const secondPublished = await publishDraftLayout(venue.id);
  assert.equal(secondPublished?.version, 2);

  const current = await prisma.floorLayout.findFirst({
    where: { venueId: venue.id, status: 'PUBLISHED', isCurrent: true }
  });
  assert.equal(current?.id, secondPublished?.id);

  const archivedCount = await prisma.floorLayout.count({
    where: { venueId: venue.id, status: 'PUBLISHED', isCurrent: false }
  });
  assert.equal(archivedCount, 1);
});

test('getPublishedLayout returns null until something has been published', async () => {
  const { venue } = await seedVenueWithTables();
  assert.equal(await getPublishedLayout(venue.id), null);

  await getOrCreateDraftLayout(venue.id);
  assert.equal(await getPublishedLayout(venue.id), null);

  await publishDraftLayout(venue.id);
  assert.notEqual(await getPublishedLayout(venue.id), null);
});
