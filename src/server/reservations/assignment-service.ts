import { BookingLifecycleStatus, Prisma } from '@prisma/client';
import { getPublishedLayout } from '@/server/floor-layout/service';
import { prisma } from '@/server/db/prisma/client';
import {
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError
} from './errors';
import { lockTablesForBooking } from './availability-service';
import { hasOverlappingWindow } from './availability';

type AssignmentContext = {
  actorUserId: string;
};

type AssignmentSnapshotTable = {
  layoutTableId: string;
  tableId: string;
  tableName: string;
  isActive: boolean;
  status: 'free' | 'assigned-selected' | 'conflict' | 'inactive';
  reason: string | null;
  conflictingReservationId: string | null;
};

const CONFLICT_BOOKING_STATUSES: BookingLifecycleStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SEATED'
];

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      currentValue instanceof Date ? currentValue.toISOString() : currentValue
    )
  ) as Prisma.InputJsonValue;
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    venueId: string;
    actorUserId: string;
    reservationId: string;
    changes: Prisma.InputJsonValue;
  }
) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      venueId: input.venueId,
      actorUserId: input.actorUserId,
      entityType: 'Reservation',
      entityId: input.reservationId,
      action: 'ASSIGN_TABLE',
      changes: input.changes
    }
  });
}

async function getScopedReservation(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  reservationId: string;
}) {
  const reservation = await input.tx.reservation.findFirst({
    where: {
      id: input.reservationId,
      organizationId: input.organizationId
    },
    include: {
      reservationTables: {
        include: { table: { select: { id: true, name: true } } }
      }
    }
  });

  if (!reservation) {
    throw new ReservationNotFoundError();
  }

  return reservation;
}

async function assertTableAssignable(input: {
  tx: Prisma.TransactionClient;
  reservationId: string;
  venueId: string;
  organizationId: string;
  tableId: string;
  partySize: number;
  startAt: Date;
  endAt: Date;
}) {
  const table = await input.tx.table.findFirst({
    where: {
      id: input.tableId,
      venueId: input.venueId
    },
    select: {
      id: true,
      isActive: true,
      capacityMin: true,
      capacityMax: true,
      area: {
        select: { isActive: true }
      }
    }
  });

  if (!table) {
    throw new ReservationValidationError(
      'Selected table is outside reservation venue scope.',
      {
        tableId: 'invalid scope'
      }
    );
  }

  if (!table.isActive || !table.area.isActive) {
    throw new ReservationValidationError(
      'Selected table is inactive and cannot be assigned.',
      {
        tableId: 'inactive'
      }
    );
  }

  if (input.partySize > table.capacityMax) {
    throw new ReservationValidationError(
      'Selected table does not have enough capacity for this party size.',
      {
        partySize: String(input.partySize),
        capacityMax: String(table.capacityMax)
      }
    );
  }

  if (table.capacityMin && input.partySize < table.capacityMin) {
    throw new ReservationValidationError(
      'Party size is below minimum capacity for the selected table.',
      {
        partySize: String(input.partySize),
        capacityMin: String(table.capacityMin)
      }
    );
  }

  const activeBlock = await input.tx.tableBlock.findFirst({
    where: {
      tableId: input.tableId,
      isActive: true,
      startsAt: { lt: input.endAt },
      endsAt: { gt: input.startAt }
    },
    select: {
      id: true,
      reason: true,
      startsAt: true,
      endsAt: true
    }
  });

  if (activeBlock) {
    throw new ReservationValidationError(
      'Selected table is blocked during this reservation window.',
      {
        tableId: 'blocked',
        blockReason: activeBlock.reason ?? 'Table block',
        blockStartsAt: activeBlock.startsAt.toISOString(),
        blockEndsAt: activeBlock.endsAt.toISOString()
      }
    );
  }

  const overlaps = await input.tx.reservationTable.findFirst({
    where: {
      tableId: input.tableId,
      reservation: {
        id: { not: input.reservationId },
        organizationId: input.organizationId,
        venueId: input.venueId,
        bookingStatus: { in: CONFLICT_BOOKING_STATUSES },
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt }
      }
    },
    select: {
      reservation: {
        select: {
          id: true,
          startAt: true,
          endAt: true,
          guest: {
            select: {
              fullName: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (overlaps) {
    const overlapGuest =
      overlaps.reservation.guest.fullName ??
      ([
        overlaps.reservation.guest.firstName,
        overlaps.reservation.guest.lastName
      ]
        .filter(Boolean)
        .join(' ') ||
        'another reservation');

    throw new ReservationConflictError(
      'Table is already assigned for an overlapping reservation window.',
      {
        tableId: 'overlap conflict',
        conflictReservationId: overlaps.reservation.id,
        conflictGuest: overlapGuest
      }
    );
  }
}

export async function getReservationAssignmentSnapshot(input: {
  organizationId: string;
  reservationId: string;
}) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, organizationId: input.organizationId },
    include: {
      guest: {
        select: {
          fullName: true,
          firstName: true,
          lastName: true
        }
      },
      reservationTables: {
        include: { table: { select: { id: true, name: true, isActive: true } } }
      }
    }
  });

  if (!reservation) {
    throw new ReservationNotFoundError();
  }

  const publishedLayout = await getPublishedLayout(reservation.venueId);

  if (!publishedLayout) {
    return {
      reservation: {
        id: reservation.id,
        venueId: reservation.venueId,
        partySize: reservation.partySize,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        bookingStatus: reservation.bookingStatus,
        assignedTableIds: reservation.reservationTables.map(
          (item) => item.tableId
        )
      },
      publishedLayout: null,
      tableStates: [] as AssignmentSnapshotTable[]
    };
  }

  const layoutTableIds = publishedLayout.tables.map((table) => table.tableId);

  const overlappingAssignments = await prisma.reservationTable.findMany({
    where: {
      tableId: { in: layoutTableIds },
      reservation: {
        id: { not: reservation.id },
        organizationId: input.organizationId,
        venueId: reservation.venueId,
        bookingStatus: { in: CONFLICT_BOOKING_STATUSES },
        startAt: { lt: reservation.endAt },
        endAt: { gt: reservation.startAt }
      }
    },
    select: {
      tableId: true,
      reservation: {
        select: {
          id: true,
          startAt: true,
          endAt: true
        }
      }
    }
  });

  const conflictByTable = new Map<string, { reservationId: string }>();
  for (const assignment of overlappingAssignments) {
    if (
      hasOverlappingWindow({
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        compareStartAt: assignment.reservation.startAt,
        compareEndAt: assignment.reservation.endAt
      })
    ) {
      conflictByTable.set(assignment.tableId, {
        reservationId: assignment.reservation.id
      });
    }
  }

  const assignedTableIds = new Set(
    reservation.reservationTables.map((item) => item.tableId)
  );

  const tableStates: AssignmentSnapshotTable[] = publishedLayout.tables.map(
    (layoutTable) => {
      if (!layoutTable.isActive) {
        return {
          layoutTableId: layoutTable.id,
          tableId: layoutTable.tableId,
          tableName: layoutTable.label,
          isActive: false,
          status: 'inactive',
          reason: 'Table is inactive in published layout.',
          conflictingReservationId: null
        };
      }

      if (assignedTableIds.has(layoutTable.tableId)) {
        return {
          layoutTableId: layoutTable.id,
          tableId: layoutTable.tableId,
          tableName: layoutTable.label,
          isActive: true,
          status: 'assigned-selected',
          reason: 'Assigned to selected reservation.',
          conflictingReservationId: null
        };
      }

      const conflict = conflictByTable.get(layoutTable.tableId);
      if (conflict) {
        return {
          layoutTableId: layoutTable.id,
          tableId: layoutTable.tableId,
          tableName: layoutTable.label,
          isActive: true,
          status: 'conflict',
          reason: 'Table already has another overlapping reservation.',
          conflictingReservationId: conflict.reservationId
        };
      }

      return {
        layoutTableId: layoutTable.id,
        tableId: layoutTable.tableId,
        tableName: layoutTable.label,
        isActive: true,
        status: 'free',
        reason: 'Table available for selected reservation window.',
        conflictingReservationId: null
      };
    }
  );

  return {
    reservation: {
      id: reservation.id,
      venueId: reservation.venueId,
      partySize: reservation.partySize,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      bookingStatus: reservation.bookingStatus,
      assignedTableIds: reservation.reservationTables.map(
        (item) => item.tableId
      )
    },
    publishedLayout,
    tableStates
  };
}

export async function setReservationTableAssignment(input: {
  organizationId: string;
  reservationId: string;
  tableId: string | null;
  context: AssignmentContext;
}) {
  await prisma.$transaction(async (tx) => {
    const reservation = await getScopedReservation({
      tx,
      organizationId: input.organizationId,
      reservationId: input.reservationId
    });

    if (!CONFLICT_BOOKING_STATUSES.includes(reservation.bookingStatus)) {
      throw new ReservationValidationError(
        'Only pending, confirmed, or seated reservations can be assigned to tables.',
        { bookingStatus: reservation.bookingStatus }
      );
    }

    const previousTableIds = reservation.reservationTables.map(
      (item) => item.tableId
    );

    if (input.tableId) {
      await lockTablesForBooking(tx, [input.tableId]);
      await assertTableAssignable({
        tx,
        reservationId: reservation.id,
        organizationId: input.organizationId,
        venueId: reservation.venueId,
        tableId: input.tableId,
        partySize: reservation.partySize,
        startAt: reservation.startAt,
        endAt: reservation.endAt
      });
    }

    await tx.reservationTable.deleteMany({
      where: { reservationId: reservation.id }
    });

    if (input.tableId) {
      await tx.reservationTable.create({
        data: {
          reservationId: reservation.id,
          tableId: input.tableId
        }
      });
    }

    await writeAuditLog(tx, {
      organizationId: input.organizationId,
      venueId: reservation.venueId,
      actorUserId: input.context.actorUserId,
      reservationId: reservation.id,
      changes: toJsonValue({
        fromTableIds: previousTableIds,
        toTableIds: input.tableId ? [input.tableId] : [],
        mode: 'SINGLE_TABLE_MVP'
      })
    });
  });

  return getReservationAssignmentSnapshot({
    organizationId: input.organizationId,
    reservationId: input.reservationId
  });
}
