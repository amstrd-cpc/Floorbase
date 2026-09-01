import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { StaffNotFoundError, StaffValidationError } from '@/server/staff/errors';
import { createStaffMember, listStaff } from '@/server/staff/service';
import { getVenueScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof StaffValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof StaffNotFoundError) {
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

    const staff = await listStaff({ venueId });
    return NextResponse.json({ staff });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
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

    const staffMember = await createStaffMember(payload);
    return NextResponse.json({ staffMember }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
