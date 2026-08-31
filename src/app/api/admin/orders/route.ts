import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  OrderNotFoundError,
  OrderValidationError
} from '@/server/orders/errors';
import { createOrder, listOrders } from '@/server/orders/service';
import { getVenueScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof OrderValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof OrderNotFoundError) {
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

  const url = new URL(request.url);
  const venueId = url.searchParams.get('venueId');
  const status = url.searchParams.get('status') ?? undefined;
  if (!venueId) {
    return NextResponse.json(
      { error: 'venueId query param is required.' },
      { status: 400 }
    );
  }

  try {
    const venue = await getVenueScope(venueId);
    if (!venue) {
      return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: venue.organizationId,
        venueId: venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested venue scope.' },
        { status: 403 }
      );
    }

    const orders = await listOrders({ venueId, status });
    return NextResponse.json({ orders });
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

  try {
    const venue = await getVenueScope(String(payload?.venueId ?? ''));
    if (!venue) {
      return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: venue.organizationId,
        venueId: venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested venue scope.' },
        { status: 403 }
      );
    }

    const order = await createOrder({ payload, actorUserId: user.id });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
