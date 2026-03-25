import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import {
  ReservationNotFoundError,
  ReservationValidationError
} from '@/server/reservations/errors';
import {
  createReservation,
  listReservations
} from '@/server/reservations/service';

async function resolveOrganizationIdForVenue(venueId: string) {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { organizationId: true }
  });
  if (!venue) {
    throw new ReservationNotFoundError('Venue not found.');
  }

  return venue.organizationId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof ReservationValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof ReservationNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function GET(request: Request) {
  await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const venueId = searchParams.get('venueId') ?? undefined;
  const statusId = searchParams.get('statusId') ?? undefined;
  const dateFrom = searchParams.get('dateFrom')
    ? new Date(searchParams.get('dateFrom') as string)
    : undefined;
  const dateTo = searchParams.get('dateTo')
    ? new Date(searchParams.get('dateTo') as string)
    : undefined;

  if (!organizationId && !venueId) {
    return NextResponse.json(
      { error: 'organizationId or venueId query param is required.' },
      { status: 400 }
    );
  }

  try {
    const scopedOrganizationId =
      organizationId ??
      (await resolveOrganizationIdForVenue(venueId as string));

    const reservations = await listReservations({
      organizationId: scopedOrganizationId,
      venueId,
      statusId,
      dateFrom,
      dateTo
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = await request.json();

  if (!payload?.venueId) {
    return NextResponse.json(
      { error: 'venueId is required.' },
      { status: 400 }
    );
  }

  try {
    const organizationId = await resolveOrganizationIdForVenue(payload.venueId);

    const reservation = await createReservation({
      organizationId,
      payload,
      context: { actorUserId: user.id }
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
