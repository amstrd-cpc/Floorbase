import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  ReservationNotFoundError,
  ReservationValidationError
} from '@/server/reservations/errors';
import {
  cancelReservation,
  changeReservationStatus,
  getReservationById,
  updateReservation
} from '@/server/reservations/service';
import { getReservationScope } from '@/server/auth/scope-resolvers';

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

export async function GET(
  request: Request,
  { params }: { params: { reservationId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const organizationId = new URL(request.url).searchParams.get(
    'organizationId'
  );
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query param is required.' },
      { status: 400 }
    );
  }

  try {
    const scope = await getReservationScope(params.reservationId);
    if (!scope || scope.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Reservation not found.' },
        { status: 404 }
      );
    }

    if (
      !hasAdminScope(user, {
        organizationId: scope.organizationId,
        venueId: scope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation = await getReservationById({
      reservationId: params.reservationId,
      organizationId
    });

    return NextResponse.json({ reservation });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { reservationId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const organizationId = new URL(request.url).searchParams.get(
    'organizationId'
  );
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query param is required.' },
      { status: 400 }
    );
  }

  const payload = await request.json();

  try {
    const scope = await getReservationScope(params.reservationId);
    if (!scope || scope.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Reservation not found.' },
        { status: 404 }
      );
    }

    if (
      !hasAdminScope(user, {
        organizationId: scope.organizationId,
        venueId: scope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation = await updateReservation({
      reservationId: params.reservationId,
      organizationId,
      payload,
      context: { actorUserId: user.id }
    });

    return NextResponse.json({ reservation });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { reservationId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = (await request.json()) as {
    organizationId?: string;
    action?: 'status' | 'cancel';
    reservationStatusId?: string;
    reason?: string;
  };

  if (!payload.organizationId || !payload.action) {
    return NextResponse.json(
      { error: 'organizationId and action are required.' },
      { status: 400 }
    );
  }

  try {
    const scope = await getReservationScope(params.reservationId);
    if (!scope || scope.organizationId !== payload.organizationId) {
      return NextResponse.json(
        { error: 'Reservation not found.' },
        { status: 404 }
      );
    }

    if (
      !hasAdminScope(user, {
        organizationId: scope.organizationId,
        venueId: scope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation =
      payload.action === 'cancel'
        ? await cancelReservation({
            reservationId: params.reservationId,
            organizationId: payload.organizationId,
            payload: { reason: payload.reason },
            context: { actorUserId: user.id }
          })
        : await changeReservationStatus({
            reservationId: params.reservationId,
            organizationId: payload.organizationId,
            payload: {
              reservationStatusId: payload.reservationStatusId as string
            },
            context: { actorUserId: user.id }
          });

    return NextResponse.json({ reservation });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { reservationId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    reason?: string;
  };
  if (!payload.organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required.' },
      { status: 400 }
    );
  }

  try {
    const scope = await getReservationScope(params.reservationId);
    if (!scope || scope.organizationId !== payload.organizationId) {
      return NextResponse.json(
        { error: 'Reservation not found.' },
        { status: 404 }
      );
    }

    if (
      !hasAdminScope(user, {
        organizationId: scope.organizationId,
        venueId: scope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested reservation scope.' },
        { status: 403 }
      );
    }

    const reservation = await cancelReservation({
      reservationId: params.reservationId,
      organizationId: payload.organizationId,
      payload: { reason: payload.reason },
      context: { actorUserId: user.id }
    });

    return NextResponse.json({ reservation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
