import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  FloorNotFoundError,
  FloorValidationError
} from '@/server/floor/errors';
import { updateArea } from '@/server/floor/service';
import { getAreaScope } from '@/server/auth/scope-resolvers';

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

export async function PUT(
  request: Request,
  { params }: { params: { areaId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);
  const payload = await request.json();

  try {
    const areaScope = await getAreaScope(params.areaId);
    if (!areaScope) {
      return NextResponse.json({ error: 'Area not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: areaScope.venue.organizationId,
        venueId: areaScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested area scope.' },
        { status: 403 }
      );
    }

    const area = await updateArea({ areaId: params.areaId, payload });
    return NextResponse.json({ area });
  } catch (error) {
    return toErrorResponse(error);
  }
}
