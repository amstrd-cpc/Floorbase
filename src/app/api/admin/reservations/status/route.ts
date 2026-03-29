import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  ReservationNotFoundError,
  ReservationValidationError
} from '@/server/reservations/errors';
import { changeReservationStatus } from '@/server/reservations/service';
import { getReservationScope } from '@/server/auth/scope-resolvers';

export async function POST(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = (await request.json()) as {
    reservationId?: string;
    reservationStatusId?: string;
    organizationId?: string;
  };

  if (
    !payload.reservationId ||
    !payload.reservationStatusId ||
    !payload.organizationId
  ) {
    return NextResponse.json(
      {
        error:
          'reservationId, reservationStatusId, and organizationId are required.'
      },
      { status: 400 }
    );
  }

  try {
    const reservationScope = await getReservationScope(payload.reservationId);
    if (!reservationScope) {
      return NextResponse.json(
        { error: 'Reservation not found.' },
        { status: 404 }
      );
    }

    if (
      reservationScope.organizationId !== payload.organizationId ||
      !hasAdminScope(user, {
        organizationId: reservationScope.organizationId,
        venueId: reservationScope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation = await changeReservationStatus({
      reservationId: payload.reservationId,
      organizationId: payload.organizationId,
      payload: { reservationStatusId: payload.reservationStatusId },
      context: { actorUserId: user.id }
    });

    return NextResponse.json({ reservation });
  } catch (error) {
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
}
