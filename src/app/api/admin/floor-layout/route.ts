import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { getVenueScope } from '@/server/auth/scope-resolvers';
import {
  getOrCreateDraftLayout,
  getPublishedLayout,
  saveDraftLayout
} from '@/server/floor-layout/service';
import {
  FloorNotFoundError,
  FloorValidationError
} from '@/server/floor/errors';

function toErrorResponse(error: unknown) {
  if (error instanceof FloorValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof FloorNotFoundError) {
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
  const venueId = new URL(request.url).searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json(
      { error: 'venueId query param is required.' },
      { status: 400 }
    );
  }

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

  try {
    const [draft, published] = await Promise.all([
      getOrCreateDraftLayout(venueId),
      getPublishedLayout(venueId)
    ]);

    return NextResponse.json({ draft, published });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);
  const payload = await request.json();

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

  try {
    const draft = await saveDraftLayout(payload);
    return NextResponse.json({ draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}
