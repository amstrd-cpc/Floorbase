import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { getReservationScope } from '@/server/auth/scope-resolvers';
import {
  getReservationAssignmentSnapshot,
  setReservationTableAssignment
} from '@/server/reservations/assignment-service';
import {
  ReservationNotFoundError,
  ReservationValidationError
} from '@/server/reservations/errors';

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

    if (!hasAdminScope(user, scope)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const snapshot = await getReservationAssignmentSnapshot({
      organizationId,
      reservationId: params.reservationId
    });

    return NextResponse.json({ snapshot });
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

  const payload = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    tableId?: string | null;
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

    if (!hasAdminScope(user, scope)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const snapshot = await setReservationTableAssignment({
      organizationId: payload.organizationId,
      reservationId: params.reservationId,
      tableId: payload.tableId ?? null,
      context: { actorUserId: user.id }
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return toErrorResponse(error);
  }
}
