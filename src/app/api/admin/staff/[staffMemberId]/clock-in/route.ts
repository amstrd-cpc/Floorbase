import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { StaffNotFoundError, StaffValidationError } from '@/server/staff/errors';
import { clockIn } from '@/server/staff/service';
import { getStaffMemberScope } from '@/server/auth/scope-resolvers';

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

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ staffMemberId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = await request.json();

  try {
    const staffScope = await getStaffMemberScope(params.staffMemberId);
    if (!staffScope) {
      return NextResponse.json(
        { error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    if (
      !hasAdminScope(user, {
        organizationId: staffScope.venue.organizationId,
        venueId: staffScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested staff scope.' },
        { status: 403 }
      );
    }

    const shift = await clockIn({
      staffMemberId: params.staffMemberId,
      payload
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
