import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { OrderPaymentError } from '@/server/order-payments/errors';
import { createOrderPaymentIntent } from '@/server/order-payments/service';
import { getOrderScope } from '@/server/auth/scope-resolvers';

const bodySchema = z
  .object({
    amountMinor: z.number().int().positive(),
    tipMinor: z.number().int().min(0).optional()
  })
  .strict();

function toErrorResponse(error: unknown) {
  if (error instanceof OrderPaymentError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  throw error;
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ orderId: string }> }
) {
  const params = await paramsPromise;

  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER',
    'HOST'
  ]);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid amountMinor is required.' },
      { status: 400 }
    );
  }

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

    const result = await createOrderPaymentIntent({
      orderId: params.orderId,
      amountMinor: parsed.data.amountMinor,
      tipMinor: parsed.data.tipMinor
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
