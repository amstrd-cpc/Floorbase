import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAdminScope, requireRole } from '@/server/auth/authorization';
import { OrderPaymentError } from '@/server/order-payments/errors';
import { refundOrderPayment } from '@/server/order-payments/service';
import { getOrderPaymentScope } from '@/server/auth/scope-resolvers';

const bodySchema = z
  .object({
    amountMinor: z.number().int().positive().optional()
  })
  .strict();

function toErrorResponse(error: unknown) {
  if (error instanceof OrderPaymentError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}

export async function POST(
  request: Request,
  { params }: { params: { paymentId: string } }
) {
  const user = await requireRole([
    'SUPER_ADMIN',
    'ORGANIZATION_ADMIN',
    'VENUE_MANAGER'
  ]);

  let rawBody: unknown = {};
  const text = await request.text();
  if (text) {
    try {
      rawBody = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid refund amount.' }, { status: 400 });
  }

  try {
    const paymentScope = await getOrderPaymentScope(params.paymentId);
    if (!paymentScope) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    if (
      !hasAdminScope(user, {
        organizationId: paymentScope.order.organizationId,
        venueId: paymentScope.order.venueId
      })
    ) {
      return NextResponse.json(
        { error: 'Forbidden for requested payment scope.' },
        { status: 403 }
      );
    }

    await refundOrderPayment({
      orderPaymentId: params.paymentId,
      amountMinor: parsed.data.amountMinor
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
