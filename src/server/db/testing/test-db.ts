import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

export type TestDatabase = {
  prisma: PrismaClient;
  url: string;
  teardown: () => Promise<void>;
};

async function startTestcontainer(): Promise<{
  url: string;
  stop: () => Promise<void>;
} | null> {
  let PostgreSqlContainer: typeof import('@testcontainers/postgresql').PostgreSqlContainer;
  try {
    ({ PostgreSqlContainer } = await import('@testcontainers/postgresql'));
  } catch {
    return null;
  }

  try {
    const container = await new PostgreSqlContainer(
      'postgres:16-alpine'
    ).start();
    return {
      url: container.getConnectionUri(),
      stop: async () => {
        await container.stop();
      }
    };
  } catch (error) {
    console.warn(
      'Docker/testcontainers unavailable, falling back to DATABASE_URL_TEST:',
      (error as Error).message
    );
    return null;
  }
}

function runMigrations(databaseUrl: string) {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit'
  });
}

/**
 * Provisions a real Postgres database for integration tests: a disposable
 * testcontainer if Docker is available, otherwise DATABASE_URL_TEST. Runs
 * migrations before handing back a connected PrismaClient.
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  const containerized = await startTestcontainer();

  const databaseUrl = containerized?.url ?? process.env.DATABASE_URL_TEST;

  if (!databaseUrl) {
    throw new Error(
      'No test database available: Docker/testcontainers failed and DATABASE_URL_TEST is not set. ' +
        'Set DATABASE_URL_TEST to a disposable Postgres connection string to run integration tests without Docker.'
    );
  }

  runMigrations(databaseUrl);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });
  await prisma.$connect();

  return {
    prisma,
    url: databaseUrl,
    teardown: async () => {
      await prisma.$disconnect();
      await containerized?.stop();
    }
  };
}

export async function resetReservationData(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "Deposit", "ReservationTable", "Reservation", "Guest" RESTART IDENTITY CASCADE;'
  );
}

export type TestFixture = {
  organizationId: string;
  venueId: string;
  venueSlug: string;
  areaId: string;
  tableId: string;
  secondaryTableId: string;
  tertiaryTableId: string;
  actorUserId: string;
  pendingStatusId: string;
  confirmedStatusId: string;
  cancelledStatusId: string;
  seatedStatusId: string;
  completedStatusId: string;
  noShowStatusId: string;
};

/**
 * Seeds the minimal fixture the reservation write paths need end-to-end:
 * org, venue, area, one bookable table (capacity 2-4), a full set of
 * reservation statuses, business hours open 24h every day (so slot-window
 * tests don't need to fight the clock), and a published floor layout
 * containing the table (listAvailableTables requires a PUBLISHED layout).
 */
export async function seedFixture(prisma: PrismaClient): Promise<TestFixture> {
  const organization = await prisma.organization.create({
    data: {
      name: 'Concurrency Test Org',
      slug: `concurrency-org-${Date.now()}`
    }
  });

  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Concurrency Test Venue',
      slug: `concurrency-venue-${Date.now()}`,
      timezone: 'UTC',
      isActive: true,
      publicBookingEnabled: true,
      bookingMode: 'AUTO_CONFIRM',
      // TABLE_SELECTION lets concurrency tests force every racing request
      // onto the exact same table via selectedTableId, rather than relying
      // on chooseBestTableSet's tie-breaking to coincidentally agree.
      placementMode: 'TABLE_SELECTION'
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
      capacityMin: 2,
      capacityMax: 4,
      isActive: true
    }
  });

  // Two extra tables used as initial placements in assignment-race tests,
  // so two reservations can each start on a distinct table before racing
  // to be reassigned onto the same target table (`table` above).
  const tableB = await prisma.table.create({
    data: {
      venueId: venue.id,
      areaId: area.id,
      name: 'T2',
      capacityMin: 2,
      capacityMax: 4,
      isActive: true
    }
  });

  const tableC = await prisma.table.create({
    data: {
      venueId: venue.id,
      areaId: area.id,
      name: 'T3',
      capacityMin: 2,
      capacityMax: 4,
      isActive: true
    }
  });

  const statusDefs = [
    { code: 'PENDING', label: 'Pending', isDefault: true, sortOrder: 10 },
    { code: 'CONFIRMED', label: 'Confirmed', isDefault: false, sortOrder: 20 },
    { code: 'SEATED', label: 'Seated', isDefault: false, sortOrder: 30 },
    { code: 'COMPLETED', label: 'Completed', isDefault: false, sortOrder: 40 },
    { code: 'NO_SHOW', label: 'No Show', isDefault: false, sortOrder: 50 },
    { code: 'CANCELLED', label: 'Cancelled', isDefault: false, sortOrder: 60 }
  ] as const;

  const statuses = new Map<string, string>();
  for (const def of statusDefs) {
    const status = await prisma.reservationStatus.create({
      data: { organizationId: organization.id, ...def, isActive: true }
    });
    statuses.set(def.code, status.id);
  }

  await Promise.all(
    Array.from({ length: 7 }, (_, dayOfWeek) =>
      prisma.businessHours.create({
        data: {
          venueId: venue.id,
          dayOfWeek,
          openTime: '00:00',
          closeTime: '23:45',
          isClosed: false
        }
      })
    )
  );

  const layout = await prisma.floorLayout.create({
    data: {
      venueId: venue.id,
      status: 'PUBLISHED',
      version: 1,
      isCurrent: true
    }
  });

  const layoutArea = await prisma.floorLayoutArea.create({
    data: {
      floorLayoutId: layout.id,
      areaId: area.id,
      name: area.name,
      isActive: true
    }
  });

  for (const t of [table, tableB, tableC]) {
    await prisma.floorLayoutTable.create({
      data: {
        floorLayoutId: layout.id,
        floorLayoutAreaId: layoutArea.id,
        tableId: t.id,
        label: t.name,
        capacityMin: t.capacityMin,
        capacityMax: t.capacityMax,
        isActive: true
      }
    });
  }

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: `concurrency-actor-${Date.now()}@example.com`,
      isActive: true
    }
  });

  return {
    organizationId: organization.id,
    venueId: venue.id,
    venueSlug: venue.slug,
    areaId: area.id,
    tableId: table.id,
    secondaryTableId: tableB.id,
    tertiaryTableId: tableC.id,
    actorUserId: user.id,
    pendingStatusId: statuses.get('PENDING')!,
    confirmedStatusId: statuses.get('CONFIRMED')!,
    cancelledStatusId: statuses.get('CANCELLED')!,
    seatedStatusId: statuses.get('SEATED')!,
    completedStatusId: statuses.get('COMPLETED')!,
    noShowStatusId: statuses.get('NO_SHOW')!
  };
}
