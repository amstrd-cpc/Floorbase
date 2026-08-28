import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { MenuNotFoundError, MenuValidationError } from '@/server/menu/errors';
import { deleteMenuCategory, updateMenuCategory } from '@/server/menu/service';
import { getMenuCategoryScope } from '@/server/auth/scope-resolvers';

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
  { params }: { params: { categoryId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  const payload = await request.json();

  try {
    const categoryScope = await getMenuCategoryScope(params.categoryId);
    if (!categoryScope) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: categoryScope.venue.organizationId,
        venueId: categoryScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested category scope.' },
        { status: 403 }
      );
    }

    const category = await updateMenuCategory({ categoryId: params.categoryId, payload });
    return NextResponse.json({ category });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { categoryId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  try {
    const categoryScope = await getMenuCategoryScope(params.categoryId);
    if (!categoryScope) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: categoryScope.venue.organizationId,
        venueId: categoryScope.venue.id
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested category scope.' },
        { status: 403 }
      );
    }

    await deleteMenuCategory({ categoryId: params.categoryId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
