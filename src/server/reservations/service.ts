import { Prisma, type ReservationStatus } from '@prisma/client';
import { canTransitionReservationStatus } from '@/lib/reservations/rules';
import { prisma } from '@/server/db/prisma/client';
import {
  MAX_RESERVATION_DURATION_MINUTES,
  MIN_RESERVATION_DURATION_MINUTES,
  computeReservationWindow,
  validateSlotAligned
} from './availability';
import {
  type CancelReservationInput,
  type ChangeReservationStatusInput,
  type CreateReservationInput,
  type UpdateReservationInput,
  cancelReservationSchema,
  changeReservationStatusSchema,
  createReservationSchema,
  updateReservationSchema
} from './validation';
import { ReservationNotFoundError, ReservationValidationError } from './errors';

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: {
    guest: true;
    status: true;
    reservationTables: {
      include: {
        table: true;
      };
    };
    deposit: true;
  };
}>;

type ReservationMutationContext = {
  actorUserId: string;
};

function toValidationError(error: unknown) {
  if (error instanceof ReservationValidationError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new ReservationValidationError(
      'Invalid persistence state for reservation mutation.',
      {
        prismaCode: error.code
      }
    );
  }

  return new ReservationValidationError('Invalid reservation payload.');
}

function mapZodErrors(
  issues: Array<{ path: Array<string | number>; message: string }>
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'root', issue.message])
  );
}

function buildGuestFullName(guest: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (guest.fullName && guest.fullName.trim().length > 0) {
    return guest.fullName.trim();
  }

  const composed = [guest.firstName, guest.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return composed || null;
}

function inferReservationDate(startAt: Date) {
  const reservationDate = new Date(startAt);
  reservationDate.setUTCHours(0, 0, 0, 0);
  return reservationDate;
}

async function getDefaultStatus(
  tx: Prisma.TransactionClient,
  organizationId: string
) {
  const defaultStatus = await tx.reservationStatus.findFirst({
    where: { organizationId, isActive: true, isDefault: true }
  });

  if (!defaultStatus) {
    throw new ReservationValidationError(
      'No default reservation status configured for organization.'
    );
  }

  return defaultStatus;
}

async function assertVenue(
  tx: Prisma.TransactionClient,
  input: { venueId: string; organizationId: string }
) {
  const venue = await tx.venue.findFirst({
    where: {
      id: input.venueId,
      organizationId: input.organizationId,
      isActive: true
    },
    select: { id: true }
  });

  if (!venue) {
    throw new ReservationValidationError(
      'Venue does not exist or is inactive for this organization.'
    );
  }
}

async function assertStatus(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; reservationStatusId: string }
): Promise<ReservationStatus> {
  const status = await tx.reservationStatus.findFirst({
    where: {
      id: input.reservationStatusId,
      organizationId: input.organizationId,
      isActive: true
    }
  });

  if (!status) {
    throw new ReservationValidationError(
      'Reservation status does not exist in this organization.'
    );
  }

  return status;
}

async function assertTableAssignments(
  tx: Prisma.TransactionClient,
  input: { venueId: string; tableIds: string[]; partySize: number }
) {
  const tables = await tx.table.findMany({
    where: {
      id: { in: input.tableIds },
      venueId: input.venueId,
      isActive: true
    },
    select: { id: true, capacityMax: true, capacityMin: true }
  });

  if (tables.length !== input.tableIds.length) {
    throw new ReservationValidationError(
      'One or more assigned tables are invalid for this venue.'
    );
  }

  const totalCapacityMax = tables.reduce(
    (sum, table) => sum + table.capacityMax,
    0
  );
  if (input.partySize > totalCapacityMax) {
    throw new ReservationValidationError(
      'Assigned tables do not have enough total capacity for the party size.',
      {
        partySize: String(input.partySize),
        totalCapacityMax: String(totalCapacityMax)
      }
    );
  }

  const partyBelowMin = tables.some(
    (table) => table.capacityMin && input.partySize < table.capacityMin
  );
  if (partyBelowMin && tables.length === 1) {
    throw new ReservationValidationError(
      'Party size is below minimum capacity for the assigned table.'
    );
  }
}

function assertDurationAndSlot(input: {
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
}) {
  if (
    input.durationMinutes < MIN_RESERVATION_DURATION_MINUTES ||
    input.durationMinutes > MAX_RESERVATION_DURATION_MINUTES
  ) {
    throw new ReservationValidationError(
      `Reservation duration must be between ${MIN_RESERVATION_DURATION_MINUTES} and ${MAX_RESERVATION_DURATION_MINUTES} minutes.`
    );
  }

  if (
    !validateSlotAligned(input.startAt) ||
    !validateSlotAligned(input.endAt)
  ) {
    throw new ReservationValidationError(
      'startAt and endAt must align to 15-minute reservation slots.'
    );
  }
}

async function assertNoTableConflicts(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    venueId: string;
    reservationIdToExclude?: string;
    tableIds: string[];
    startAt: Date;
    endAt: Date;
  }
) {
  const overlaps = await tx.reservationTable.findMany({
    where: {
      tableId: { in: input.tableIds },
      reservation: {
        organizationId: input.organizationId,
        venueId: input.venueId,
        ...(input.reservationIdToExclude
          ? { id: { not: input.reservationIdToExclude } }
          : {}),
        status: {
          code: { not: 'CANCELED' }
        },
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt }
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
    },
    take: 1
  });

  if (overlaps.length > 0) {
    const overlap = overlaps[0];
    throw new ReservationValidationError(
      'One or more assigned tables are unavailable for the selected time window.',
      {
        tableId: overlap.tableId,
        conflictingReservationId: overlap.reservation.id,
        conflictingStartAt: overlap.reservation.startAt.toISOString(),
        conflictingEndAt: overlap.reservation.endAt.toISOString()
      }
    );
  }
}


function assertStatusTransition(input: {
  currentStatusCode: string;
  nextStatusCode: string;
}) {
  if (!canTransitionReservationStatus(input.currentStatusCode, input.nextStatusCode)) {
    throw new ReservationValidationError(
      `Invalid reservation status transition from ${input.currentStatusCode} to ${input.nextStatusCode}.`
    );
  }
}

async function createOrUpdateGuest(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    guest: {
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    existingGuestId?: string;
  }
) {
  const guestData = {
    firstName: input.guest.firstName?.trim() || null,
    lastName: input.guest.lastName?.trim() || null,
    fullName: buildGuestFullName(input.guest),
    email: input.guest.email?.trim() || null,
    phone: input.guest.phone?.trim() || null
  };

  if (input.existingGuestId) {
    return tx.guest.update({
      where: { id: input.existingGuestId },
      data: guestData,
      select: { id: true }
    });
  }

  return tx.guest.create({
    data: {
      organizationId: input.organizationId,
      ...guestData
    },
    select: { id: true }
  });
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    venueId: string;
    actorUserId: string;
    reservationId: string;
    action:
      | 'CREATE'
      | 'UPDATE'
      | 'STATUS_CHANGE'
      | 'ASSIGN_TABLE'
      | 'NOTE_ADDED';
    changes?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      venueId: input.venueId,
      actorUserId: input.actorUserId,
      entityType: 'Reservation',
      entityId: input.reservationId,
      action: input.action,
      changes: input.changes,
      metadata: input.metadata
    }
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      currentValue instanceof Date ? currentValue.toISOString() : currentValue
    )
  ) as Prisma.InputJsonValue;
}

async function upsertDeposit(
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    depositRequired: boolean;
    deposit?: CreateReservationInput['deposit'];
  }
) {
  if (!input.depositRequired) {
    await tx.deposit.deleteMany({
      where: { reservationId: input.reservationId }
    });
    return;
  }

  if (!input.deposit) {
    return;
  }

  await tx.deposit.upsert({
    where: { reservationId: input.reservationId },
    create: {
      reservationId: input.reservationId,
      amountMinor: input.deposit.amountMinor,
      currency: input.deposit.currency,
      status: input.deposit.status,
      paidAt: input.deposit.paidAt,
      provider: input.deposit.provider,
      providerRef: input.deposit.providerRef
    },
    update: {
      amountMinor: input.deposit.amountMinor,
      currency: input.deposit.currency,
      status: input.deposit.status,
      paidAt: input.deposit.paidAt,
      provider: input.deposit.provider,
      providerRef: input.deposit.providerRef
    }
  });
}

export async function createReservation(input: {
  organizationId: string;
  payload: CreateReservationInput;
  context: ReservationMutationContext;
}) {
  try {
    const parsed = createReservationSchema.safeParse(input.payload);
    if (!parsed.success) {
      throw new ReservationValidationError(
        'Reservation payload validation failed.',
        mapZodErrors(parsed.error.issues)
      );
    }

    return await prisma.$transaction(async (tx) => {
      const reservationWindow = computeReservationWindow({
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        durationMinutes: parsed.data.durationMinutes
      });
      assertDurationAndSlot(reservationWindow);

      await assertVenue(tx, {
        venueId: parsed.data.venueId,
        organizationId: input.organizationId
      });
      await assertTableAssignments(tx, {
        venueId: parsed.data.venueId,
        tableIds: parsed.data.tableIds,
        partySize: parsed.data.partySize
      });
      await assertNoTableConflicts(tx, {
        organizationId: input.organizationId,
        venueId: parsed.data.venueId,
        tableIds: parsed.data.tableIds,
        startAt: reservationWindow.startAt,
        endAt: reservationWindow.endAt
      });

      const status = parsed.data.reservationStatusId
        ? await assertStatus(tx, {
            organizationId: input.organizationId,
            reservationStatusId: parsed.data.reservationStatusId
          })
        : await getDefaultStatus(tx, input.organizationId);

      const guest = await createOrUpdateGuest(tx, {
        organizationId: input.organizationId,
        guest: parsed.data.guest
      });

      const reservation = await tx.reservation.create({
        data: {
          organizationId: input.organizationId,
          venueId: parsed.data.venueId,
          guestId: guest.id,
          reservationStatusId: status.id,
          reservationDate: inferReservationDate(reservationWindow.startAt),
          startAt: reservationWindow.startAt,
          endAt: reservationWindow.endAt,
          partySize: parsed.data.partySize,
          source: parsed.data.source,
          internalNotes: parsed.data.internalNotes,
          specialRequests: parsed.data.specialRequests,
          depositRequired: parsed.data.depositRequired ?? false,
          createdByUserId: input.context.actorUserId,
          updatedByUserId: input.context.actorUserId,
          reservationTables: {
            createMany: {
              data: parsed.data.tableIds.map((tableId) => ({ tableId }))
            }
          }
        },
        select: { id: true, venueId: true }
      });

      await upsertDeposit(tx, {
        reservationId: reservation.id,
        depositRequired: parsed.data.depositRequired ?? false,
        deposit: parsed.data.deposit
      });

      await writeAuditLog(tx, {
        organizationId: input.organizationId,
        venueId: reservation.venueId,
        actorUserId: input.context.actorUserId,
        reservationId: reservation.id,
        action: 'CREATE',
        changes: toJsonValue({
          partySize: parsed.data.partySize,
          startAt: reservationWindow.startAt.toISOString(),
          endAt: reservationWindow.endAt.toISOString(),
          durationMinutes: reservationWindow.durationMinutes,
          reservationStatusId: status.id,
          tableIds: parsed.data.tableIds
        })
      });

      return getReservationByIdInternal(
        tx,
        reservation.id,
        input.organizationId
      );
    });
  } catch (error) {
    throw toValidationError(error);
  }
}

async function getReservationByIdInternal(
  tx: Prisma.TransactionClient,
  reservationId: string,
  organizationId: string
) {
  const reservation = await tx.reservation.findFirst({
    where: { id: reservationId, organizationId },
    include: {
      guest: true,
      status: true,
      reservationTables: { include: { table: true } },
      deposit: true
    }
  });

  if (!reservation) {
    throw new ReservationNotFoundError();
  }

  return reservation;
}

export async function getReservationById(input: {
  reservationId: string;
  organizationId: string;
}) {
  return prisma.$transaction((tx) =>
    getReservationByIdInternal(tx, input.reservationId, input.organizationId)
  );
}

export async function listReservations(input: {
  organizationId: string;
  venueId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  statusId?: string;
}) {
  return prisma.reservation.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.venueId ? { venueId: input.venueId } : {}),
      ...(input.statusId ? { reservationStatusId: input.statusId } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            startAt: {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          }
        : {})
    },
    include: {
      guest: true,
      status: true,
      reservationTables: { include: { table: true } },
      deposit: true
    },
    orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }]
  });
}

export async function updateReservation(input: {
  reservationId: string;
  organizationId: string;
  payload: UpdateReservationInput;
  context: ReservationMutationContext;
}) {
  const parsed = updateReservationSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new ReservationValidationError(
      'Reservation payload validation failed.',
      mapZodErrors(parsed.error.issues)
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await getReservationByIdInternal(
      tx,
      input.reservationId,
      input.organizationId
    );

    const venueId = parsed.data.venueId ?? current.venueId;
    const partySize = parsed.data.partySize ?? current.partySize;
    const tableIds =
      parsed.data.tableIds ??
      current.reservationTables.map(
        (reservationTable) => reservationTable.tableId
      );

    const nextStartAt = parsed.data.startAt ?? current.startAt;
    const reservationWindow = computeReservationWindow({
      startAt: nextStartAt,
      endAt: parsed.data.endAt ?? current.endAt,
      durationMinutes: parsed.data.durationMinutes
    });

    if (reservationWindow.endAt <= reservationWindow.startAt) {
      throw new ReservationValidationError('endAt must be after startAt.', {
        endAt: 'must be later than startAt'
      });
    }
    assertDurationAndSlot(reservationWindow);

    await assertVenue(tx, { venueId, organizationId: input.organizationId });
    await assertTableAssignments(tx, { venueId, tableIds, partySize });
    await assertNoTableConflicts(tx, {
      organizationId: input.organizationId,
      venueId,
      reservationIdToExclude: current.id,
      tableIds,
      startAt: reservationWindow.startAt,
      endAt: reservationWindow.endAt
    });

    if (parsed.data.reservationStatusId) {
      const nextStatus = await assertStatus(tx, {
        organizationId: input.organizationId,
        reservationStatusId: parsed.data.reservationStatusId
      });

      assertStatusTransition({
        currentStatusCode: current.status.code,
        nextStatusCode: nextStatus.code
      });
    }

    let guestId = current.guestId;
    if (parsed.data.guest) {
      const mergedGuest = {
        firstName: parsed.data.guest.firstName ?? current.guest.firstName,
        lastName: parsed.data.guest.lastName ?? current.guest.lastName,
        fullName: parsed.data.guest.fullName ?? current.guest.fullName,
        email: parsed.data.guest.email ?? current.guest.email,
        phone: parsed.data.guest.phone ?? current.guest.phone
      };

      if (!mergedGuest.email && !mergedGuest.phone) {
        throw new ReservationValidationError(
          'At least one guest contact method (email or phone) is required.'
        );
      }

      const guest = await createOrUpdateGuest(tx, {
        organizationId: input.organizationId,
        guest: mergedGuest,
        existingGuestId: current.guestId
      });

      guestId = guest.id;
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        venueId,
        guestId,
        reservationStatusId:
          parsed.data.reservationStatusId ?? current.reservationStatusId,
        reservationDate:
          parsed.data.reservationDate ??
          inferReservationDate(reservationWindow.startAt),
        startAt: reservationWindow.startAt,
        endAt: reservationWindow.endAt,
        partySize,
        source: parsed.data.source ?? current.source,
        internalNotes: parsed.data.internalNotes ?? current.internalNotes,
        specialRequests: parsed.data.specialRequests ?? current.specialRequests,
        depositRequired: parsed.data.depositRequired ?? current.depositRequired,
        updatedByUserId: input.context.actorUserId
      },
      select: { id: true, venueId: true, depositRequired: true }
    });

    if (parsed.data.tableIds) {
      await tx.reservationTable.deleteMany({
        where: { reservationId: current.id }
      });
      await tx.reservationTable.createMany({
        data: parsed.data.tableIds.map((tableId) => ({
          reservationId: current.id,
          tableId
        }))
      });

      await writeAuditLog(tx, {
        organizationId: input.organizationId,
        venueId: updated.venueId,
        actorUserId: input.context.actorUserId,
        reservationId: updated.id,
        action: 'ASSIGN_TABLE',
        changes: toJsonValue({ tableIds: parsed.data.tableIds })
      });
    }

    if (
      parsed.data.internalNotes !== undefined &&
      parsed.data.internalNotes !== current.internalNotes
    ) {
      await writeAuditLog(tx, {
        organizationId: input.organizationId,
        venueId: updated.venueId,
        actorUserId: input.context.actorUserId,
        reservationId: updated.id,
        action: 'NOTE_ADDED',
        changes: toJsonValue({
          internalNotes: {
            from: current.internalNotes,
            to: parsed.data.internalNotes
          }
        })
      });
    }

    await upsertDeposit(tx, {
      reservationId: current.id,
      depositRequired: parsed.data.depositRequired ?? current.depositRequired,
      deposit: parsed.data.deposit
    });

    await writeAuditLog(tx, {
      organizationId: input.organizationId,
      venueId: updated.venueId,
      actorUserId: input.context.actorUserId,
      reservationId: updated.id,
      action: 'UPDATE',
      changes: toJsonValue(parsed.data)
    });

    return getReservationByIdInternal(tx, current.id, input.organizationId);
  });
}

export async function changeReservationStatus(input: {
  reservationId: string;
  organizationId: string;
  payload: ChangeReservationStatusInput;
  context: ReservationMutationContext;
}) {
  const parsed = changeReservationStatusSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new ReservationValidationError(
      'Reservation status payload validation failed.',
      mapZodErrors(parsed.error.issues)
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await getReservationByIdInternal(
      tx,
      input.reservationId,
      input.organizationId
    );
    const nextStatus = await assertStatus(tx, {
      organizationId: input.organizationId,
      reservationStatusId: parsed.data.reservationStatusId
    });

    assertStatusTransition({
      currentStatusCode: current.status.code,
      nextStatusCode: nextStatus.code
    });

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        reservationStatusId: nextStatus.id,
        updatedByUserId: input.context.actorUserId
      },
      select: { id: true, venueId: true }
    });

    await writeAuditLog(tx, {
      organizationId: input.organizationId,
      venueId: updated.venueId,
      actorUserId: input.context.actorUserId,
      reservationId: updated.id,
      action: 'STATUS_CHANGE',
      changes: toJsonValue({
        fromStatusId: current.status.id,
        toStatusId: nextStatus.id
      })
    });

    return getReservationByIdInternal(tx, current.id, input.organizationId);
  });
}

export async function cancelReservation(input: {
  reservationId: string;
  organizationId: string;
  payload: CancelReservationInput;
  context: ReservationMutationContext;
}) {
  const parsed = cancelReservationSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new ReservationValidationError(
      'Reservation cancel payload validation failed.',
      mapZodErrors(parsed.error.issues)
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await getReservationByIdInternal(
      tx,
      input.reservationId,
      input.organizationId
    );

    if (current.status.code === 'CANCELED') {
      return current;
    }

    const canceledStatus = await tx.reservationStatus.findFirst({
      where: {
        organizationId: input.organizationId,
        code: 'CANCELED',
        isActive: true
      }
    });

    if (!canceledStatus) {
      throw new ReservationValidationError(
        'Canceled status is not configured for this organization.'
      );
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        reservationStatusId: canceledStatus.id,
        updatedByUserId: input.context.actorUserId,
        internalNotes: [
          current.internalNotes,
          parsed.data.reason
            ? `Cancellation reason: ${parsed.data.reason}`
            : null
        ]
          .filter(Boolean)
          .join('\n')
      },
      select: { id: true, venueId: true }
    });

    await writeAuditLog(tx, {
      organizationId: input.organizationId,
      venueId: updated.venueId,
      actorUserId: input.context.actorUserId,
      reservationId: updated.id,
      action: 'STATUS_CHANGE',
      changes: toJsonValue({
        fromStatusId: current.status.id,
        toStatusId: canceledStatus.id
      }),
      metadata: toJsonValue({
        reason: parsed.data.reason ?? null,
        triggeredBy: 'cancelReservation'
      })
    });

    return getReservationByIdInternal(tx, current.id, input.organizationId);
  });
}

export type ReservationRecord = ReservationWithRelations;
