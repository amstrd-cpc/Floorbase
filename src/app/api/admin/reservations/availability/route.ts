import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import {
  canPlaceReservation,
  listAvailableSlots,
  listAvailableTables
} from '@/server/reservations/availability-service';

async function resolveOrganizationIdForVenue(venueId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { organizationId: true }
  });

  return venue?.organizationId ?? null;
}

export async function GET(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get('venueId');
  const startAt = searchParams.get('startAt');
  const endAt = searchParams.get('endAt');
  const date = searchParams.get('date');
  const partySize = Number(searchParams.get('partySize') ?? '0');
  const durationMinutes = searchParams.get('durationMinutes')
    ? Number(searchParams.get('durationMinutes'))
    : undefined;
  const tableIds = searchParams.getAll('tableId');
  const reservationIdToExclude =
    searchParams.get('reservationIdToExclude') ?? undefined;

  if (!venueId || !partySize || partySize < 1) {
    return NextResponse.json(
      { error: 'venueId and partySize are required.' },
      { status: 400 }
    );
  }

  const organizationId = await resolveOrganizationIdForVenue(venueId);
  if (!organizationId) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (!hasAdminScope(user, { organizationId, venueId })) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (date) {
    const slots = await listAvailableSlots({
      organizationId,
      venueId,
      date: new Date(date),
      partySize,
      durationMinutes
    });

    return NextResponse.json({
      slots: slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        recommendedTableIds: slot.recommendedTableIds
      }))
    });
  }

  if (!startAt) {
    return NextResponse.json(
      { error: 'startAt is required for table/placement checks.' },
      { status: 400 }
    );
  }

  const tableAvailability = await listAvailableTables({
    organizationId,
    venueId,
    startAt: new Date(startAt),
    endAt: endAt ? new Date(endAt) : undefined,
    durationMinutes,
    partySize,
    reservationIdToExclude
  });

  const placement =
    tableIds.length > 0
      ? await canPlaceReservation({
          organizationId,
          venueId,
          startAt: new Date(startAt),
          endAt: endAt ? new Date(endAt) : undefined,
          durationMinutes,
          partySize,
          tableIds,
          reservationIdToExclude
        })
      : null;

  return NextResponse.json({
    allowed: tableAvailability.allowed,
    reason: tableAvailability.reason,
    recommendedTableIds: tableAvailability.recommendedTableIds,
    availableTables: tableAvailability.availableTables,
    canPlaceRequestedTables: placement
  });
}
