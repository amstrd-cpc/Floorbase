import { NextResponse } from 'next/server';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import {
  OrderNotFoundError,
  OrderValidationError
} from '@/server/orders/errors';
import { addOrderLine } from '@/server/orders/service';
import { getOrderScope } from '@/server/auth/scope-resolvers';

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

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  const payload = await request.json();

  try {
    const orderScope = await getOrderScope(params.orderId);
    if (!orderScope) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: orderScope.organizationId,
        venueId: orderScope.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested order scope.' },
        { status: 403 }
      );
    }

    const order = await addOrderLine({ orderId: params.orderId, payload });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
