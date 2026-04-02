import { prisma } from '@/server/db/prisma/client';
import { chooseBestTable, type AssignableTable } from './table-assignment';
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

type CandidateTable = AssignableTable & {
  name: string;
  areaId: string | null;
};

type BusyInterval = {
  tableId: string;
  startAt: Date;
  endAt: Date;
};

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const weekdayIndexMap: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
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

function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short'
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayText = String(lookup.weekday ?? '')
    .slice(0, 3)
    .toLowerCase();

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    weekday: weekdayIndexMap[weekdayText]
  };
}

function toZonedMinutes(date: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function weekdayFor(date: Date, timeZone: string) {
  return getZonedDateTimeParts(date, timeZone).weekday;
}

function zonedTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}) {
  let guessUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0
  );

  for (let index = 0; index < 3; index += 1) {
    const parts = getZonedDateTimeParts(new Date(guessUtc), input.timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const targetAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0);

    guessUtc += targetAsUtc - localAsUtc;
  }

  return new Date(guessUtc);
}

async function getVenuePolicy(venueId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { timezone: true }
  });

  if (!venue) {
    throw new Error('Venue not found for availability policy resolution.');
  }

  const [businessHours, blackoutRules] = await Promise.all([
    prisma.businessHours.findMany({ where: { venueId } }),
    prisma.blackoutRule.findMany({ where: { venueId } })
  ]);

  return { businessHours, blackoutRules, timezone: venue.timezone || 'UTC' };
}

async function getPublishedFloorTables(input: {
  organizationId: string;
  venueId: string;
  allowedAreaIds?: string[];
  allowedTableIds?: string[];
}) {
  const publishedLayout = await prisma.floorLayout.findFirst({
    where: {
      venueId: input.venueId,
      venue: { organizationId: input.organizationId },
      status: 'PUBLISHED',
      isCurrent: true
    },
    select: {
      tables: {
        where: {
          isActive: true,
          ...(input.allowedTableIds && input.allowedTableIds.length > 0
            ? { tableId: { in: input.allowedTableIds } }
            : {}),
          table: {
            isActive: true,
            area: {
              isActive: true,
              ...(input.allowedAreaIds && input.allowedAreaIds.length > 0
                ? { id: { in: input.allowedAreaIds } }
                : {})
            }
          }
        },
        select: {
          tableId: true,
          label: true,
          capacityMin: true,
          capacityMax: true,
          isActive: true,
          table: {
            select: {
              name: true,
              areaId: true
            }
          },
          floorLayoutArea: {
            select: { areaId: true }
          }
        }
      }
    }
  });

  if (!publishedLayout) {
    return [] as CandidateTable[];
  }

  return publishedLayout.tables.map((table) => ({
    id: table.tableId,
    label: table.label || table.table.name,
    name: table.table.name,
    capacityMin: table.capacityMin,
    capacityMax: table.capacityMax,
    isActive: table.isActive,
    areaId: table.floorLayoutArea?.areaId ?? table.table.areaId
  }));
}

function isWithinBusinessHours(input: {
  window: AvailabilityWindow;
  dayHours: { openTime: string; closeTime: string; isClosed: boolean } | null;
  timeZone: string;
}) {
  if (!input.dayHours || input.dayHours.isClosed) {
    return false;
  }

  const open = parseHourMinute(input.dayHours.openTime);
  const close = parseHourMinute(input.dayHours.closeTime);

  const startMinutes = toZonedMinutes(input.window.startAt, input.timeZone);
  const endMinutes = toZonedMinutes(input.window.endAt, input.timeZone);
  const openMinutes = open.hours * 60 + open.minutes;
  const closeMinutes = close.hours * 60 + close.minutes;

  if (weekdayFor(input.window.startAt, input.timeZone) !== weekdayFor(input.window.endAt, input.timeZone)) {
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

export async function listAvailableTables(input: {
  organizationId: string;
  venueId: string;
  startAt: Date;
  endAt?: Date;
  durationMinutes?: number;
  partySize: number;
  reservationIdToExclude?: string;
  allowedAreaIds?: string[];
  allowedTableIds?: string[];
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

  const { businessHours, blackoutRules, timezone } = await getVenuePolicy(input.venueId);
  const dayHours = businessHours.find((hours) => hours.dayOfWeek === weekdayFor(window.startAt, timezone)) ?? null;

  if (!isWithinBusinessHours({ window, dayHours, timeZone: timezone })) {
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
    getPublishedFloorTables(input),
    prisma.reservationTable.findMany({
      where: {
        table: { venueId: input.venueId },
        reservation: {
          organizationId: input.organizationId,
          venueId: input.venueId,
          ...(input.reservationIdToExclude ? { id: { not: input.reservationIdToExclude } } : {}),
          bookingStatus: { not: 'CANCELLED' },
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

  const availableTables = tables.filter((table) => !isTableBlocked({ tableId: table.id, window, busyIntervals }));
  const bestTable = chooseBestTable(availableTables, input.partySize);

  return {
    allowed: Boolean(bestTable),
    reason: bestTable ? null : ('NO_CAPACITY' as const),
    availableTables,
    recommendedTableIds: bestTable ? [bestTable.id] : [],
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
  allowedAreaIds?: string[];
  allowedTableIds?: string[];
}) {
  const durationMinutes = input.durationMinutes ?? DEFAULT_RESERVATION_DURATION_MINUTES;
  const { businessHours, timezone } = await getVenuePolicy(input.venueId);
  const zonedDate = getZonedDateTimeParts(input.date, timezone);
  const dayHours = businessHours.find((hours) => hours.dayOfWeek === zonedDate.weekday);

  if (!dayHours || dayHours.isClosed) {
    return [] as Array<{
      startAt: Date;
      endAt: Date;
      recommendedTableIds: string[];
      availableTables: Array<{ id: string; name: string; capacityMax: number }>;
    }>;
  }

  const open = parseHourMinute(dayHours.openTime);
  const close = parseHourMinute(dayHours.closeTime);

  const cursor = zonedTimeToUtc({
    year: zonedDate.year,
    month: zonedDate.month,
    day: zonedDate.day,
    hour: open.hours,
    minute: open.minutes,
    timeZone: timezone
  });

  const closeAt = zonedTimeToUtc({
    year: zonedDate.year,
    month: zonedDate.month,
    day: zonedDate.day,
    hour: close.hours,
    minute: close.minutes,
    timeZone: timezone
  });

  const slots: Array<{
    startAt: Date;
    endAt: Date;
    recommendedTableIds: string[];
    availableTables: Array<{ id: string; name: string; capacityMax: number }>;
  }> = [];

  while (addMinutes(cursor, durationMinutes) <= closeAt) {
    const slotStart = new Date(cursor);
    const slotAvailability = await listAvailableTables({
      organizationId: input.organizationId,
      venueId: input.venueId,
      startAt: slotStart,
      durationMinutes,
      partySize: input.partySize,
      allowedAreaIds: input.allowedAreaIds,
      allowedTableIds: input.allowedTableIds
    });

    if (slotAvailability.allowed) {
      slots.push({
        startAt: slotAvailability.window.startAt,
        endAt: slotAvailability.window.endAt,
        recommendedTableIds: slotAvailability.recommendedTableIds,
        availableTables: slotAvailability.availableTables.map((table) => ({
          id: table.id,
          name: table.label,
          capacityMax: table.capacityMax
        }))
      });
    }

    cursor.setUTCMinutes(cursor.getUTCMinutes() + RESERVATION_SLOT_MINUTES);
  }

  return slots;
}
