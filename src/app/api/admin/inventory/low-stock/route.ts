import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { InventoryError } from '@/server/inventory/errors';
import { listLowStockItems } from '@/server/inventory/service';
import { getVenueScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof InventoryError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
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

  const venueId = new URL(request.url).searchParams.get('venueId');
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

    const items = await listLowStockItems({ venueId });
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
