import { prisma } from '@/server/db/prisma/client';
import {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  RESERVATION_SLOT_MINUTES,
  addMinutes,
  computeReservationWindow,
  hasOverlappingWindow,
  validateSlotAligned
} from './availability';

type AvailabilityWindow = {
  startAt: Date;
  endAt: Date;
};

type CandidateTable = {
  id: string;
  name: string;
  capacityMax: number;
  capacityMin: number | null;
};

type BusyInterval = {
  tableId: string;
  startAt: Date;
  endAt: Date;
};

function parseHourMinute(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid business hour format: ${value}`);
  }

  return { hours, minutes };
}

function toUtcMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function weekdayFor(date: Date) {
  return date.getUTCDay();
}

async function getVenuePolicy(venueId: string) {
  const [businessHours, blackoutRules] = await Promise.all([
    prisma.businessHours.findMany({ where: { venueId } }),
    prisma.blackoutRule.findMany({ where: { venueId } })
  ]);

  return { businessHours, blackoutRules };
}

function isWithinBusinessHours(input: {
  window: AvailabilityWindow;
  dayHours: { openTime: string; closeTime: string; isClosed: boolean } | null;
}) {
  if (!input.dayHours || input.dayHours.isClosed) {
    return false;
  }

  const open = parseHourMinute(input.dayHours.openTime);
  const close = parseHourMinute(input.dayHours.closeTime);

  const startMinutes = toUtcMinutes(input.window.startAt);
  const endMinutes = toUtcMinutes(input.window.endAt);
  const openMinutes = open.hours * 60 + open.minutes;
  const closeMinutes = close.hours * 60 + close.minutes;

  if (weekdayFor(input.window.startAt) !== weekdayFor(input.window.endAt)) {
    return false;
  }

  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

function isInsideBlackout(input: {
  window: AvailabilityWindow;
  blackouts: Array<{ startsAt: Date; endsAt: Date }>;
}) {
  return input.blackouts.some((blackout) =>
    hasOverlappingWindow({
      startAt: input.window.startAt,
      endAt: input.window.endAt,
      compareStartAt: blackout.startsAt,
      compareEndAt: blackout.endsAt
    })
  );
}

function isTableBlocked(input: {
  tableId: string;
  window: AvailabilityWindow;
  busyIntervals: BusyInterval[];
}) {
  return input.busyIntervals.some(
    (interval) =>
      interval.tableId === input.tableId &&
      hasOverlappingWindow({
        startAt: input.window.startAt,
        endAt: input.window.endAt,
        compareStartAt: interval.startAt,
        compareEndAt: interval.endAt
      })
  );
}

function chooseMinimalTableSet(
  tables: CandidateTable[],
  partySize: number
): CandidateTable[] {
  const sorted = [...tables].sort((a, b) => {
    if (a.capacityMax !== b.capacityMax) {
      return a.capacityMax - b.capacityMax;
    }

    return a.name.localeCompare(b.name);
  });

  let remaining = partySize;
  const selected: CandidateTable[] = [];
  for (const table of sorted) {
    if (remaining <= 0) {
      break;
    }

    selected.push(table);
    remaining -= table.capacityMax;
  }

  return remaining <= 0 ? selected : [];
}

export async function listAvailableTables(input: {
  organizationId: string;
  venueId: string;
  startAt: Date;
  endAt?: Date;
  durationMinutes?: number;
  partySize: number;
  reservationIdToExclude?: string;
}) {
  const window = computeReservationWindow({
    startAt: input.startAt,
    endAt: input.endAt,
    durationMinutes: input.durationMinutes
  });

  if (!validateSlotAligned(window.startAt) || !validateSlotAligned(window.endAt)) {
    return {
      availableTables: [],
      recommendedTableIds: [],
      allowed: false,
      reason: 'SLOT_ALIGNMENT' as const,
      window
    };
  }

  const { businessHours, blackoutRules } = await getVenuePolicy(input.venueId);
  const dayHours =
    businessHours.find((hours) => hours.dayOfWeek === weekdayFor(window.startAt)) ??
    null;

  if (!isWithinBusinessHours({ window, dayHours })) {
    return {
      availableTables: [],
      recommendedTableIds: [],
      allowed: false,
      reason: 'OUTSIDE_BUSINESS_HOURS' as const,
      window
    };
  }

  if (isInsideBlackout({ window, blackouts: blackoutRules })) {
    return {
      availableTables: [],
      recommendedTableIds: [],
      allowed: false,
      reason: 'BLACKOUT' as const,
      window
    };
  }

  const [tables, conflictingReservations, tableBlocks] = await Promise.all([
    prisma.table.findMany({
      where: {
        venueId: input.venueId,
        venue: { organizationId: input.organizationId },
        isActive: true,
        capacityMax: { gte: 1 }
      },
      select: { id: true, name: true, capacityMax: true, capacityMin: true },
      orderBy: [{ capacityMax: 'asc' }, { name: 'asc' }]
    }),
    prisma.reservationTable.findMany({
      where: {
        table: { venueId: input.venueId },
        reservation: {
          organizationId: input.organizationId,
          venueId: input.venueId,
          ...(input.reservationIdToExclude ? { id: { not: input.reservationIdToExclude } } : {}),
          status: { code: { not: 'CANCELED' } },
          startAt: { lt: window.endAt },
          endAt: { gt: window.startAt }
        }
      },
      select: {
        tableId: true,
        reservation: { select: { startAt: true, endAt: true } }
      }
    }),
    prisma.tableBlock.findMany({
      where: {
        isActive: true,
        table: { venueId: input.venueId },
        startsAt: { lt: window.endAt },
        endsAt: { gt: window.startAt }
      },
      select: { tableId: true, startsAt: true, endsAt: true }
    })
  ]);

  const busyIntervals: BusyInterval[] = [
    ...conflictingReservations.map((item) => ({
      tableId: item.tableId,
      startAt: item.reservation.startAt,
      endAt: item.reservation.endAt
    })),
    ...tableBlocks.map((item) => ({
      tableId: item.tableId,
      startAt: item.startsAt,
      endAt: item.endsAt
    }))
  ];

  const availableTables = tables.filter((table) => {
    if (table.capacityMin && input.partySize < table.capacityMin) {
      return false;
    }

    return !isTableBlocked({ tableId: table.id, window, busyIntervals });
  });

  const recommendedTables = chooseMinimalTableSet(availableTables, input.partySize);

  return {
    allowed: recommendedTables.length > 0,
    reason: recommendedTables.length > 0 ? null : ('NO_CAPACITY' as const),
    availableTables,
    recommendedTableIds: recommendedTables.map((table) => table.id),
    window
  };
}

export async function canPlaceReservation(input: {
  organizationId: string;
  venueId: string;
  startAt: Date;
  endAt?: Date;
  durationMinutes?: number;
  partySize: number;
  tableIds: string[];
  reservationIdToExclude?: string;
}) {
  const availability = await listAvailableTables(input);
  if (!availability.allowed) {
    return { ok: false, reason: availability.reason };
  }

  const tableSet = new Set(availability.availableTables.map((table) => table.id));
  const allRequestedAreAvailable = input.tableIds.every((tableId) => tableSet.has(tableId));

  return {
    ok: allRequestedAreAvailable,
    reason: allRequestedAreAvailable ? null : ('TABLE_UNAVAILABLE' as const)
  };
}

export async function listAvailableSlots(input: {
  organizationId: string;
  venueId: string;
  date: Date;
  partySize: number;
  durationMinutes?: number;
}) {
  const durationMinutes = input.durationMinutes ?? DEFAULT_RESERVATION_DURATION_MINUTES;
  const { businessHours } = await getVenuePolicy(input.venueId);
  const dayHours = businessHours.find((hours) => hours.dayOfWeek === weekdayFor(input.date));

  if (!dayHours || dayHours.isClosed) {
    return [] as Array<{ startAt: Date; endAt: Date; recommendedTableIds: string[] }>;
  }

  const open = parseHourMinute(dayHours.openTime);
  const close = parseHourMinute(dayHours.closeTime);

  const cursor = new Date(input.date);
  cursor.setUTCHours(open.hours, open.minutes, 0, 0);

  const closeAt = new Date(input.date);
  closeAt.setUTCHours(close.hours, close.minutes, 0, 0);

  const slots: Array<{ startAt: Date; endAt: Date; recommendedTableIds: string[] }> = [];

  while (addMinutes(cursor, durationMinutes) <= closeAt) {
    const slotStart = new Date(cursor);
    const slotAvailability = await listAvailableTables({
      organizationId: input.organizationId,
      venueId: input.venueId,
      startAt: slotStart,
      durationMinutes,
      partySize: input.partySize
    });

    if (slotAvailability.allowed) {
      slots.push({
        startAt: slotAvailability.window.startAt,
        endAt: slotAvailability.window.endAt,
        recommendedTableIds: slotAvailability.recommendedTableIds
      });
    }

    cursor.setUTCMinutes(cursor.getUTCMinutes() + RESERVATION_SLOT_MINUTES);
  }

  return slots;
}
