import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import { publishDraftLayout } from '@/server/floor-layout/service';
import { FloorNotFoundError, FloorValidationError } from '@/server/floor/errors';

function toErrorResponse(error: unknown) {
  if (error instanceof FloorValidationError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  }

  if (error instanceof FloorNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function POST(request: Request) {
  const user = await requireRole(['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'VENUE_MANAGER']);
  const payload = await request.json();

  const venue = await getVenueScope(String(payload?.venueId ?? ''));
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
  }

  if (!hasAdminScope(user, { organizationId: venue.organizationId, venueId: venue.id })) {
    return NextResponse.json({ error: 'Forbidden for requested venue scope.' }, { status: 403 });
  }

  try {
    const published = await publishDraftLayout(venue.id);
    return NextResponse.json({ published });
  } catch (error) {
    return toErrorResponse(error);
  }
}
