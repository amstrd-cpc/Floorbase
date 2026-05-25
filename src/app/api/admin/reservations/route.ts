import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { prisma } from '@/server/db/prisma/client';
import {
  ReservationNotFoundError,
  ReservationValidationError
} from '@/server/reservations/errors';
import {
  createReservation,
  listReservations
} from '@/server/reservations/service';
import { sendVenueNewReservationAlert } from '@/server/email/service';
import { env } from '@/env';

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
  const user = await requireRole([
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

    if (
      !hasAdminScope(user, { organizationId: scopedOrganizationId, venueId })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

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

    if (!hasAdminScope(user, { organizationId, venueId: payload.venueId })) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation = await createReservation({
      organizationId,
      payload,
      context: { actorUserId: user.id }
    });

    // Send venue alert in background — never fail the request on email error.
    void sendAdminReservationAlert({ reservation, organizationId });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function sendAdminReservationAlert(input: {
  reservation: { id: string; startAt: Date; partySize: number; guest: { fullName: string | null; email: string | null; phone: string | null } };
  organizationId: string;
}) {
  try {
    const [venue, orgAdmin] = await Promise.all([
      prisma.venue.findFirst({
        where: { organizationId: input.organizationId, isActive: true },
        select: { name: true, timezone: true },
      }),
      prisma.user.findFirst({
        where: {
          organizationId: input.organizationId,
          isActive: true,
          adminRoles: { some: { role: 'ORGANIZATION_ADMIN', isActive: true } },
        },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!venue || !orgAdmin?.email) return;

    void sendVenueNewReservationAlert({
      to: orgAdmin.email,
      venueName: venue.name,
      guestName: input.reservation.guest.fullName ?? 'Guest',
      guestEmail: input.reservation.guest.email,
      guestPhone: input.reservation.guest.phone,
      startAt: input.reservation.startAt,
      timezone: venue.timezone,
      partySize: input.reservation.partySize,
      source: 'Admin',
      appUrl: env.APP_URL,
      reservationId: input.reservation.id,
    });
  } catch (err) {
    console.error('Admin reservation email error', err);
  }
}
