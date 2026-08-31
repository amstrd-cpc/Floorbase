import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { InventoryError } from '@/server/inventory/errors';
import { adjustMenuItemStock } from '@/server/inventory/service';
import { getMenuItemScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof InventoryError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  throw error;
}

export async function POST(
  request: Request,
  { params }: { params: { itemId: string } }
) {
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

    const item = await adjustMenuItemStock({
      menuItemId: params.itemId,
      payload
    });
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
