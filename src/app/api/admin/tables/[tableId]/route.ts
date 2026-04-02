import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  FloorNotFoundError,
  FloorValidationError
} from '@/server/floor/errors';
import { deleteTable, updateTable } from '@/server/floor/service';
import { getTableScope } from '@/server/auth/scope-resolvers';

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
  { params }: { params: { tableId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  const payload = await request.json();

  try {
    const tableScope = await getTableScope(params.tableId);
    if (!tableScope) {
      return NextResponse.json({ error: 'Table not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: tableScope.venue.organizationId,
        venueId: tableScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested table scope.' },
        { status: 403 }
      );
    }

    const table = await updateTable({ tableId: params.tableId, payload });
    return NextResponse.json({ table });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tableId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  try {
    const tableScope = await getTableScope(params.tableId);
    if (!tableScope) {
      return NextResponse.json({ error: 'Table not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: tableScope.venue.organizationId,
        venueId: tableScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested table scope.' },
        { status: 403 }
      );
    }

    await deleteTable({ tableId: params.tableId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
