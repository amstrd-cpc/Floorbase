import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { OrderNotFoundError, OrderValidationError } from '@/server/orders/errors';
import { removeOrderLine, updateOrderLine } from '@/server/orders/service';
import { getOrderLineScope } from '@/server/auth/scope-resolvers';

function toErrorResponse(error: unknown) {
  if (error instanceof OrderValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof OrderNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function PUT(
  request: Request,
  { params }: { params: { lineId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = await request.json();

  try {
    const lineScope = await getOrderLineScope(params.lineId);
    if (!lineScope) {
      return NextResponse.json({ error: 'Order line not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: lineScope.order.organizationId,
        venueId: lineScope.order.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested order scope.' },
        { status: 403 }
      );
    }

    const order = await updateOrderLine({ lineId: params.lineId, payload });
    return NextResponse.json({ order });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { lineId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  try {
    const lineScope = await getOrderLineScope(params.lineId);
    if (!lineScope) {
      return NextResponse.json({ error: 'Order line not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: lineScope.order.organizationId,
        venueId: lineScope.order.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested order scope.' },
        { status: 403 }
      );
    }

    const order = await removeOrderLine({ lineId: params.lineId });
    return NextResponse.json({ order });
  } catch (error) {
    return toErrorResponse(error);
  }
}
