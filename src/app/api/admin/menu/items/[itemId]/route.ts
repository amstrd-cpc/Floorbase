import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { MenuNotFoundError, MenuValidationError } from '@/server/menu/errors';
import { deleteMenuItem, updateMenuItem } from '@/server/menu/service';
import { getMenuItemScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof MenuValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof MenuNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function PUT(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ itemId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  const payload = await request.json();

  try {
    const itemScope = await getMenuItemScope(params.itemId);
    if (!itemScope) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: itemScope.venue.organizationId,
        venueId: itemScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested item scope.' },
        { status: 403 }
      );
    }

    const item = await updateMenuItem({ itemId: params.itemId, payload });
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ itemId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  try {
    const itemScope = await getMenuItemScope(params.itemId);
    if (!itemScope) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: itemScope.venue.organizationId,
        venueId: itemScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested item scope.' },
        { status: 403 }
      );
    }

    await deleteMenuItem({ itemId: params.itemId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
