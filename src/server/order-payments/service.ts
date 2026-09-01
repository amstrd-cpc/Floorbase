import { getStripe } from '@/server/billing/stripe';
import { prisma } from '@/server/db/prisma/client';
import {
  computeOrderTotalMinor,
  lockOrderForMutation
} from '@/server/orders/service';
import { OrderPaymentError } from './errors';

const STRIPE_PROVIDER = 'stripe';
const SETTLED_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED'] as const;

export function computeOrderPaymentSummary(input: {
  lines: Array<{ priceMinorSnapshot: number; quantity: number }>;
  payments: Array<{
    status: string;
    amountMinor: number;
    tipMinor: number;
    refundedMinor: number;
  }>;
}) {
  const orderTotalMinor = computeOrderTotalMinor(input.lines);
  const paidTowardOrderMinor = input.payments
    .filter((payment) =>
      (SETTLED_STATUSES as readonly string[]).includes(payment.status)
    )
    .reduce(
      (sum, payment) => sum + (payment.amountMinor - payment.refundedMinor),
      0
    );
  const remainingMinor = Math.max(0, orderTotalMinor - paidTowardOrderMinor);

  return { orderTotalMinor, paidTowardOrderMinor, remainingMinor };
}

// Order-amount and tip refunds are tracked as two separate counters (not
// pooled into one) so that refunding just the tip never makes
// computeOrderPaymentSummary's paidTowardOrderMinor - which only reads
// amountMinor/refundedMinor - think part of the order itself went unpaid.
// Draws from the tip first: a tip-only refund is the more common standalone
// action (e.g. a service complaint) than a partial goods refund.
export function computeRefundSplit(input: {
  amountMinor: number;
  tipMinor: number;
  refundedMinor: number;
  refundedTipMinor: number;
  requestedMinor: number;
}) {
  const orderRefundableMinor = input.amountMinor - input.refundedMinor;
  const tipRefundableMinor = input.tipMinor - input.refundedTipMinor;
  const refundableMinor = orderRefundableMinor + tipRefundableMinor;

  const tipRefundMinor = Math.min(input.requestedMinor, tipRefundableMinor);
  const orderRefundMinor = input.requestedMinor - tipRefundMinor;

  const newRefundedMinor = input.refundedMinor + orderRefundMinor;
  const newRefundedTipMinor = input.refundedTipMinor + tipRefundMinor;
  const isFullyRefunded =
    newRefundedMinor >= input.amountMinor &&
    newRefundedTipMinor >= input.tipMinor;

  return {
    refundableMinor,
    newRefundedMinor,
    newRefundedTipMinor,
    isFullyRefunded
  };
}

export async function createOrderPaymentIntent(input: {
  orderId: string;
  amountMinor: number;
  tipMinor?: number;
}): Promise<{
  paymentId: string;
  clientSecret: string;
  amountMinor: number;
  tipMinor: number;
  currency: string;
}> {
  if (input.amountMinor <= 0) {
    throw new OrderPaymentError('Payment amount must be greater than zero.');
  }

  const tipMinor = input.tipMinor ?? 0;
  if (tipMinor < 0) {
    throw new OrderPaymentError('Tip cannot be negative.');
  }

  // Reserve the amount (create a PENDING row) inside a locked transaction
  // before ever calling Stripe. Without the lock, two concurrent requests
  // can each read the same "remaining balance" and both pass the check,
  // together overshooting the order total. PENDING payments count toward
  // the reservation here (unlike computeOrderPaymentSummary's settled-only
  // view used for display/refunds) precisely so the second request sees
  // the first's in-flight reservation instead of racing past it.
  const reserved = await prisma.$transaction(async (tx) => {
    await lockOrderForMutation(tx, input.orderId);

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        lines: true,
        payments: true,
        venue: { select: { currency: true } }
      }
    });
    if (!order) {
      throw new OrderPaymentError('Order not found.', 404);
    }
    if (order.status !== 'OPEN') {
      throw new OrderPaymentError('Order is not open.', 409);
    }

    const orderTotalMinor = computeOrderTotalMinor(order.lines);
    const reservedMinor = order.payments
      .filter((payment) => payment.status !== 'FAILED')
      .reduce(
        (sum, payment) => sum + (payment.amountMinor - payment.refundedMinor),
        0
      );
    const remainingMinor = Math.max(0, orderTotalMinor - reservedMinor);
    if (input.amountMinor > remainingMinor) {
      throw new OrderPaymentError(
        `Payment amount exceeds the remaining balance (${remainingMinor} minor units).`
      );
    }

    const payment = await tx.orderPayment.create({
      data: {
        orderId: order.id,
        amountMinor: input.amountMinor,
        tipMinor,
        currency: order.venue.currency,
        provider: STRIPE_PROVIDER
      }
    });

    return { paymentId: payment.id, currency: order.venue.currency };
  });

  const stripe = getStripe();

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amountMinor + tipMinor,
      currency: reserved.currency.toLowerCase(),
      metadata: { orderId: input.orderId },
      automatic_payment_methods: { enabled: true }
    });

    if (!paymentIntent.client_secret) {
      throw new OrderPaymentError(
        'Stripe did not return a payment secret.',
        502
      );
    }

    await prisma.orderPayment.update({
      where: { id: reserved.paymentId },
      data: { providerRef: paymentIntent.id }
    });

    return {
      paymentId: reserved.paymentId,
      clientSecret: paymentIntent.client_secret,
      amountMinor: input.amountMinor,
      tipMinor,
      currency: reserved.currency
    };
  } catch (error) {
    // Release the reservation so the failed attempt doesn't permanently
    // block the remaining balance from being retried.
    await prisma.orderPayment.update({
      where: { id: reserved.paymentId },
      data: { status: 'FAILED' }
    });
    throw error instanceof OrderPaymentError
      ? error
      : new OrderPaymentError('Failed to create payment with Stripe.', 502);
  }
}

export async function refundOrderPayment(input: {
  orderPaymentId: string;
  amountMinor?: number;
}): Promise<void> {
  const payment = await prisma.orderPayment.findUnique({
    where: { id: input.orderPaymentId }
  });
  if (!payment) {
    throw new OrderPaymentError('Payment not found.', 404);
  }
  if (!(SETTLED_STATUSES as readonly string[]).includes(payment.status)) {
    throw new OrderPaymentError(
      'Only a succeeded payment can be refunded.',
      409
    );
  }
  if (!payment.provider || !payment.providerRef) {
    throw new OrderPaymentError(
      'Payment has no linked provider charge to refund.',
      409
    );
  }

  const refundableMinor =
    payment.amountMinor -
    payment.refundedMinor +
    (payment.tipMinor - payment.refundedTipMinor);
  const requestedMinor = input.amountMinor ?? refundableMinor;

  if (requestedMinor <= 0 || requestedMinor > refundableMinor) {
    throw new OrderPaymentError(
      `Refund amount must be between 1 and ${refundableMinor} minor units.`
    );
  }

  const stripe = getStripe();
  await stripe.refunds.create({
    payment_intent: payment.providerRef,
    amount: requestedMinor
  });

  const split = computeRefundSplit({
    amountMinor: payment.amountMinor,
    tipMinor: payment.tipMinor,
    refundedMinor: payment.refundedMinor,
    refundedTipMinor: payment.refundedTipMinor,
    requestedMinor
  });

  await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      refundedMinor: split.newRefundedMinor,
      refundedTipMinor: split.newRefundedTipMinor,
      status: split.isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
    }
  });
}

export async function markOrderPaymentSucceededByIntent(
  paymentIntentId: string
): Promise<void> {
  await prisma.orderPayment.updateMany({
    where: {
      provider: STRIPE_PROVIDER,
      providerRef: paymentIntentId,
      status: { notIn: ['REFUNDED', 'PARTIALLY_REFUNDED'] }
    },
    data: { status: 'SUCCEEDED' }
  });
}

export async function markOrderPaymentFailedByIntent(
  paymentIntentId: string
): Promise<void> {
  await prisma.orderPayment.updateMany({
    where: {
      provider: STRIPE_PROVIDER,
      providerRef: paymentIntentId,
      status: 'PENDING'
    },
    data: { status: 'FAILED' }
  });
}
