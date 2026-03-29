import {
  randomBytes,
  scrypt as scryptCallback,
  type ScryptOptions
} from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function scrypt(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}

const DEFAULT_STATUSES = [
  {
    code: 'PENDING',
    label: 'Pending',
    sortOrder: 10,
    isDefault: true,
    color: '#f59e0b'
  },
  {
    code: 'CONFIRMED',
    label: 'Confirmed',
    sortOrder: 20,
    isDefault: false,
    color: '#16a34a'
  },
  {
    code: 'SEATED',
    label: 'Seated',
    sortOrder: 30,
    isDefault: false,
    color: '#2563eb'
  },
  {
    code: 'COMPLETED',
    label: 'Completed',
    sortOrder: 40,
    isDefault: false,
    color: '#6b7280'
  },
  {
    code: 'NO_SHOW',
    label: 'No Show',
    sortOrder: 50,
    isDefault: false,
    color: '#dc2626'
  },
  {
    code: 'CANCELED',
    label: 'Canceled',
    sortOrder: 60,
    isDefault: false,
    color: '#7c3aed'
  }
] as const;

const ORGANIZATION = {
  name: 'Northfork Hospitality Group',
  slug: 'northfork-hospitality'
} as const;
const VENUE = {
  name: 'Harbor House',
  slug: 'harbor-house',
  timezone: 'America/New_York',
  currency: 'USD'
} as const;

const AREAS = [
  { name: 'Main Dining Room', sortOrder: 10 },
  { name: 'Patio', sortOrder: 20 },
  { name: 'Bar', sortOrder: 30 }
] as const;

const TABLES = [
  {
    areaName: 'Main Dining Room',
    name: 'Table 11',
    code: 'M11',
    capacityMin: 2,
    capacityMax: 2
  },
  {
    areaName: 'Main Dining Room',
    name: 'Table 12',
    code: 'M12',
    capacityMin: 2,
    capacityMax: 2
  },
  {
    areaName: 'Main Dining Room',
    name: 'Table 21',
    code: 'M21',
    capacityMin: 2,
    capacityMax: 4
  },
  {
    areaName: 'Main Dining Room',
    name: 'Table 22',
    code: 'M22',
    capacityMin: 2,
    capacityMax: 4
  },
  {
    areaName: 'Main Dining Room',
    name: 'Table 31',
    code: 'M31',
    capacityMin: 4,
    capacityMax: 6
  },
  {
    areaName: 'Patio',
    name: 'Patio 1',
    code: 'P1',
    capacityMin: 2,
    capacityMax: 2
  },
  {
    areaName: 'Patio',
    name: 'Patio 2',
    code: 'P2',
    capacityMin: 2,
    capacityMax: 4
  },
  {
    areaName: 'Patio',
    name: 'Patio 3',
    code: 'P3',
    capacityMin: 4,
    capacityMax: 4
  },
  {
    areaName: 'Bar',
    name: 'Bar 1',
    code: 'B1',
    capacityMin: 1,
    capacityMax: 2
  },
  { areaName: 'Bar', name: 'Bar 2', code: 'B2', capacityMin: 1, capacityMax: 2 }
] as const;

const STAFF_USERS = [
  {
    email: 'owner@harborhouse.dev',
    firstName: 'Morgan',
    lastName: 'Lee',
    membershipRole: 'OWNER' as const,
    adminRole: 'ORGANIZATION_ADMIN' as const
  },
  {
    email: 'manager@harborhouse.dev',
    firstName: 'Avery',
    lastName: 'Patel',
    membershipRole: 'MANAGER' as const,
    adminRole: 'VENUE_MANAGER' as const
  },
  {
    email: 'host@harborhouse.dev',
    firstName: 'Jordan',
    lastName: 'Kim',
    membershipRole: 'HOST' as const,
    adminRole: 'HOST' as const
  }
] as const;

const SUPER_ADMIN_USER = {
  email: 'platform-admin@floorbase.dev',
  firstName: 'Casey',
  lastName: 'Rowe',
  adminRole: 'SUPER_ADMIN' as const
};

const GUESTS = [
  {
    firstName: 'Emma',
    lastName: 'Watts',
    fullName: 'Emma Watts',
    email: 'emma.watts@example.com',
    phone: '+1-917-555-0101',
    notes: 'Prefers patio when weather allows.',
    tags: ['patio']
  },
  {
    firstName: 'Daniel',
    lastName: 'Ruiz',
    fullName: 'Daniel Ruiz',
    email: 'daniel.ruiz@example.com',
    phone: '+1-917-555-0102',
    notes: 'Shellfish allergy noted.',
    tags: ['allergy-shellfish']
  },
  {
    firstName: 'Priya',
    lastName: 'Shah',
    fullName: 'Priya Shah',
    email: 'priya.shah@example.com',
    phone: '+1-917-555-0103',
    notes: 'Celebrating birthday.',
    tags: ['birthday']
  },
  {
    firstName: 'Noah',
    lastName: 'Bennett',
    fullName: 'Noah Bennett',
    email: 'noah.bennett@example.com',
    phone: '+1-917-555-0104',
    notes: null,
    tags: ['walk-in-regular']
  }
] as const;

const BUSINESS_HOURS = [
  { dayOfWeek: 0, openTime: '11:00', closeTime: '21:00', isClosed: false },
  { dayOfWeek: 1, openTime: '11:30', closeTime: '22:00', isClosed: false },
  { dayOfWeek: 2, openTime: '11:30', closeTime: '22:00', isClosed: false },
  { dayOfWeek: 3, openTime: '11:30', closeTime: '22:00', isClosed: false },
  { dayOfWeek: 4, openTime: '11:30', closeTime: '23:00', isClosed: false },
  { dayOfWeek: 5, openTime: '10:30', closeTime: '23:00', isClosed: false },
  { dayOfWeek: 6, openTime: '10:30', closeTime: '21:30', isClosed: false }
] as const;

function atTime(base: Date, hour: number, minute = 0) {
  const date = new Date(base);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

async function hashSeedPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1
  })) as Buffer;
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

async function seedOrganization() {
  return prisma.organization.upsert({
    where: { slug: ORGANIZATION.slug },
    update: { name: ORGANIZATION.name, isActive: true },
    create: { name: ORGANIZATION.name, slug: ORGANIZATION.slug }
  });
}

async function seedVenue(organizationId: string) {
  return prisma.venue.upsert({
    where: { organizationId_slug: { organizationId, slug: VENUE.slug } },
    update: {
      name: VENUE.name,
      timezone: VENUE.timezone,
      currency: VENUE.currency,
      isActive: true
    },
    create: {
      organizationId,
      name: VENUE.name,
      slug: VENUE.slug,
      timezone: VENUE.timezone,
      currency: VENUE.currency
    }
  });
}

async function seedReservationStatuses(organizationId: string) {
  for (const status of DEFAULT_STATUSES) {
    await prisma.reservationStatus.upsert({
      where: { organizationId_code: { organizationId, code: status.code } },
      update: {
        label: status.label,
        color: status.color,
        sortOrder: status.sortOrder,
        isDefault: status.isDefault,
        isActive: true
      },
      create: {
        organizationId,
        code: status.code,
        label: status.label,
        color: status.color,
        sortOrder: status.sortOrder,
        isDefault: status.isDefault
      }
    });
  }

  const statuses = await prisma.reservationStatus.findMany({
    where: { organizationId, isActive: true }
  });
  return Object.fromEntries(statuses.map((status) => [status.code, status]));
}

async function seedAreasAndTables(venueId: string) {
  const areaByName = new Map<string, string>();

  for (const area of AREAS) {
    const createdArea = await prisma.area.upsert({
      where: { venueId_name: { venueId, name: area.name } },
      update: { sortOrder: area.sortOrder, isActive: true },
      create: { venueId, name: area.name, sortOrder: area.sortOrder }
    });

    areaByName.set(area.name, createdArea.id);
  }

  for (const table of TABLES) {
    const areaId = areaByName.get(table.areaName);
    if (!areaId)
      throw new Error(`Area not found for table seed: ${table.name}`);

    await prisma.table.upsert({
      where: { venueId_name: { venueId, name: table.name } },
      update: {
        areaId,
        code: table.code,
        capacityMin: table.capacityMin,
        capacityMax: table.capacityMax,
        shape:
          (
            table as {
              shape?:
                | 'SQUARE'
                | 'ROUND'
                | 'RECTANGLE'
                | 'BOOTH'
                | 'HIGH_TOP'
                | 'BAR'
                | 'COUNTER'
                | 'CUSTOM';
            }
          ).shape ?? 'SQUARE',
        tableType:
          (
            table as {
              tableType?:
                | 'STANDARD'
                | 'OUTDOOR'
                | 'BAR'
                | 'PRIVATE'
                | 'ACCESSIBLE'
                | 'FLEX';
            }
          ).tableType ?? 'STANDARD',
        canCombine: (table as { canCombine?: boolean }).canCombine ?? false,
        combineGroup: (table as { combineGroup?: string }).combineGroup ?? null,
        isActive: true
      },
      create: {
        venueId,
        areaId,
        name: table.name,
        code: table.code,
        capacityMin: table.capacityMin,
        capacityMax: table.capacityMax,
        shape:
          (
            table as {
              shape?:
                | 'SQUARE'
                | 'ROUND'
                | 'RECTANGLE'
                | 'BOOTH'
                | 'HIGH_TOP'
                | 'BAR'
                | 'COUNTER'
                | 'CUSTOM';
            }
          ).shape ?? 'SQUARE',
        tableType:
          (
            table as {
              tableType?:
                | 'STANDARD'
                | 'OUTDOOR'
                | 'BAR'
                | 'PRIVATE'
                | 'ACCESSIBLE'
                | 'FLEX';
            }
          ).tableType ?? 'STANDARD',
        canCombine: (table as { canCombine?: boolean }).canCombine ?? false,
        combineGroup: (table as { combineGroup?: string }).combineGroup ?? null
      }
    });
  }
}

async function seedBusinessHours(venueId: string) {
  for (const row of BUSINESS_HOURS) {
    await prisma.businessHours.upsert({
      where: { venueId_dayOfWeek: { venueId, dayOfWeek: row.dayOfWeek } },
      update: {
        openTime: row.openTime,
        closeTime: row.closeTime,
        isClosed: row.isClosed
      },
      create: {
        venueId,
        dayOfWeek: row.dayOfWeek,
        openTime: row.openTime,
        closeTime: row.closeTime,
        isClosed: row.isClosed
      }
    });
  }
}

async function seedSuperAdminUser() {
  const seedPasswordHash = await hashSeedPassword(
    process.env.SEED_DEFAULT_PASSWORD ?? 'DevPassword123!'
  );

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_USER.email },
    update: {
      organizationId: null,
      firstName: SUPER_ADMIN_USER.firstName,
      lastName: SUPER_ADMIN_USER.lastName,
      passwordHash: seedPasswordHash,
      isActive: true
    },
    create: {
      email: SUPER_ADMIN_USER.email,
      firstName: SUPER_ADMIN_USER.firstName,
      lastName: SUPER_ADMIN_USER.lastName,
      passwordHash: seedPasswordHash,
      isActive: true
    }
  });

  const scopeKey = `${superAdmin.id}:SUPER_ADMIN:global:global`;

  await prisma.adminRoleAssignment.upsert({
    where: { scopeKey },
    update: { isActive: true },
    create: {
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
      organizationId: null,
      venueId: null,
      scopeKey,
      isActive: true
    }
  });
}

async function seedStaffUsers(input: {
  organizationId: string;
  venueId: string;
}) {
  const usersByEmail = new Map<string, string>();
  const seedPasswordHash = await hashSeedPassword(
    process.env.SEED_DEFAULT_PASSWORD ?? 'DevPassword123!'
  );

  for (const user of STAFF_USERS) {
    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        organizationId: input.organizationId,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: true,
        passwordHash: seedPasswordHash
      },
      create: {
        organizationId: input.organizationId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: seedPasswordHash
      }
    });

    usersByEmail.set(user.email, createdUser.id);

    await prisma.membership.upsert({
      where: {
        organizationId_userId_role: {
          organizationId: input.organizationId,
          userId: createdUser.id,
          role: user.membershipRole
        }
      },
      update: { isActive: true },
      create: {
        organizationId: input.organizationId,
        userId: createdUser.id,
        role: user.membershipRole,
        isActive: true
      }
    });

    const venueScoped =
      user.adminRole === 'VENUE_MANAGER' || user.adminRole === 'HOST'
        ? input.venueId
        : null;
    const scopeKey = `${createdUser.id}:${user.adminRole}:${input.organizationId}:${venueScoped ?? 'global'}`;

    await prisma.adminRoleAssignment.upsert({
      where: { scopeKey },
      update: { isActive: true },
      create: {
        userId: createdUser.id,
        role: user.adminRole,
        organizationId: input.organizationId,
        venueId: venueScoped,
        scopeKey,
        isActive: true
      }
    });
  }

  return usersByEmail;
}

async function seedGuests(organizationId: string) {
  const guestsByEmail = new Map<string, string>();

  for (const guest of GUESTS) {
    const existingGuest = await prisma.guest.findFirst({
      where: { organizationId, email: guest.email }
    });
    const createdGuest = existingGuest
      ? await prisma.guest.update({
          where: { id: existingGuest.id },
          data: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            fullName: guest.fullName,
            phone: guest.phone,
            notes: guest.notes,
            tags: guest.tags
          }
        })
      : await prisma.guest.create({
          data: {
            organizationId,
            firstName: guest.firstName,
            lastName: guest.lastName,
            fullName: guest.fullName,
            email: guest.email,
            phone: guest.phone,
            notes: guest.notes,
            tags: guest.tags
          }
        });

    guestsByEmail.set(guest.email, createdGuest.id);
  }

  return guestsByEmail;
}

async function seedSampleReservations(input: {
  organizationId: string;
  venueId: string;
  statusByCode: Record<string, { id: string }>;
  usersByEmail: Map<string, string>;
  guestsByEmail: Map<string, string>;
}) {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const schedule = [
    {
      key: 'today-confirmed-emma',
      guestEmail: 'emma.watts@example.com',
      statusCode: 'CONFIRMED',
      tableName: 'Patio 2',
      startAt: atTime(today, 18, 30),
      endAt: atTime(today, 20, 0),
      partySize: 4,
      source: 'website',
      specialRequests: 'Window-side patio seating if available.',
      internalNotes: 'Anniversary note added by host.'
    },
    {
      key: 'today-seated-daniel',
      guestEmail: 'daniel.ruiz@example.com',
      statusCode: 'SEATED',
      tableName: 'Table 21',
      startAt: atTime(today, 19, 0),
      endAt: atTime(today, 20, 30),
      partySize: 3,
      source: 'phone',
      specialRequests: 'No shellfish in shared dishes.',
      internalNotes: 'Allergy reconfirmed on arrival.'
    },
    {
      key: 'tomorrow-pending-priya',
      guestEmail: 'priya.shah@example.com',
      statusCode: 'PENDING',
      tableName: 'Table 31',
      startAt: atTime(new Date(today.getTime() + 86400000), 20, 0),
      endAt: atTime(new Date(today.getTime() + 86400000), 22, 0),
      partySize: 6,
      source: 'widget',
      specialRequests: 'Birthday dessert with candle.',
      internalNotes: 'Pending callback for final headcount.'
    },
    {
      key: 'yesterday-canceled-noah',
      guestEmail: 'noah.bennett@example.com',
      statusCode: 'CANCELED',
      tableName: 'Bar 1',
      startAt: atTime(new Date(today.getTime() - 86400000), 17, 30),
      endAt: atTime(new Date(today.getTime() - 86400000), 18, 30),
      partySize: 2,
      source: 'walk-in',
      specialRequests: null,
      internalNotes: 'Canceled by guest due to delay.'
    },
    {
      key: 'two-days-ago-completed-emma',
      guestEmail: 'emma.watts@example.com',
      statusCode: 'COMPLETED',
      tableName: 'Table 12',
      startAt: atTime(new Date(today.getTime() - 172800000), 12, 30),
      endAt: atTime(new Date(today.getTime() - 172800000), 14, 0),
      partySize: 2,
      source: 'website',
      specialRequests: null,
      internalNotes: 'Lunch prefix menu selected.'
    }
  ] as const;

  for (const reservation of schedule) {
    const guestId = input.guestsByEmail.get(reservation.guestEmail);
    const status = input.statusByCode[reservation.statusCode];
    const createdByUserId =
      input.usersByEmail.get('host@harborhouse.dev') ?? null;

    if (!guestId || !status) {
      throw new Error(
        `Missing seed dependency for reservation ${reservation.guestEmail}/${reservation.statusCode}`
      );
    }

    const createdReservation = await prisma.reservation.upsert({
      where: { id: `seed-${reservation.key}` },
      update: {
        reservationStatusId: status.id,
        reservationDate: reservation.startAt,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        partySize: reservation.partySize,
        source: reservation.source,
        specialRequests: reservation.specialRequests,
        internalNotes: reservation.internalNotes,
        updatedByUserId: createdByUserId
      },
      create: {
        id: `seed-${reservation.key}`,
        organizationId: input.organizationId,
        venueId: input.venueId,
        guestId,
        reservationStatusId: status.id,
        reservationDate: reservation.startAt,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        partySize: reservation.partySize,
        source: reservation.source,
        specialRequests: reservation.specialRequests,
        internalNotes: reservation.internalNotes,
        createdByUserId
      }
    });

    const table = await prisma.table.findFirstOrThrow({
      where: { venueId: input.venueId, name: reservation.tableName },
      select: { id: true }
    });

    await prisma.reservationTable.upsert({
      where: {
        reservationId_tableId: {
          reservationId: createdReservation.id,
          tableId: table.id
        }
      },
      update: {},
      create: { reservationId: createdReservation.id, tableId: table.id }
    });
  }
}

async function main() {
  const organization = await seedOrganization();
  const venue = await seedVenue(organization.id);

  await seedAreasAndTables(venue.id);
  await seedBusinessHours(venue.id);

  const statusByCode = await seedReservationStatuses(organization.id);
  await seedSuperAdminUser();
  const usersByEmail = await seedStaffUsers({
    organizationId: organization.id,
    venueId: venue.id
  });
  const guestsByEmail = await seedGuests(organization.id);

  await seedSampleReservations({
    organizationId: organization.id,
    venueId: venue.id,
    statusByCode,
    usersByEmail,
    guestsByEmail
  });

  console.log(
    'Seeded organization, venue, roles, users, guests, statuses, and sample reservations.'
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
