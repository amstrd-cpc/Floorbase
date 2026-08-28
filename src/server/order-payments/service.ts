import { getStripe } from '@/server/billing/stripe';
import { prisma } from '@/server/db/prisma/client';
import { computeOrderTotalMinor } from '@/server/orders/service';
import { OrderPaymentError } from './errors';

const STRIPE_PROVIDER = 'stripe';
const SETTLED_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED'] as const;

export function computeOrderPaymentSummary(input: {
  lines: Array<{ priceMinorSnapshot: number; quantity: number }>;
  payments: Array<{ status: string; amountMinor: number; tipMinor: number; refundedMinor: number }>;
}) {
  const orderTotalMinor = computeOrderTotalMinor(input.lines);
  const paidTowardOrderMinor = input.payments
    .filter((payment) => (SETTLED_STATUSES as readonly string[]).includes(payment.status))
    .reduce((sum, payment) => sum + (payment.amountMinor - payment.refundedMinor), 0);
  const remainingMinor = Math.max(0, orderTotalMinor - paidTowardOrderMinor);

  return { orderTotalMinor, paidTowardOrderMinor, remainingMinor };
}

export async function createOrderPaymentIntent(input: {
  orderId: string;
  amountMinor: number;
  tipMinor?: number;
}): Promise<{ paymentId: string; clientSecret: string; amountMinor: number; tipMinor: number; currency: string }> {
  if (input.amountMinor <= 0) {
    throw new OrderPaymentError('Payment amount must be greater than zero.');
  }

  const order = await prisma.order.findUnique({
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

  const { remainingMinor } = computeOrderPaymentSummary(order);
  if (input.amountMinor > remainingMinor) {
    throw new OrderPaymentError(
      `Payment amount exceeds the remaining balance (${remainingMinor} minor units).`
    );
  }

  const tipMinor = input.tipMinor ?? 0;
  if (tipMinor < 0) {
    throw new OrderPaymentError('Tip cannot be negative.');
  }

  const currency = order.venue.currency;
  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.amountMinor + tipMinor,
    currency: currency.toLowerCase(),
    metadata: { orderId: order.id },
    automatic_payment_methods: { enabled: true }
  });

  if (!paymentIntent.client_secret) {
    throw new OrderPaymentError('Stripe did not return a payment secret.', 502);
  }

  const payment = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: input.amountMinor,
      tipMinor,
      currency,
      provider: STRIPE_PROVIDER,
      providerRef: paymentIntent.id
    }
  });

  return {
    paymentId: payment.id,
    clientSecret: paymentIntent.client_secret,
    amountMinor: input.amountMinor,
    tipMinor,
    currency
  };
}

export async function refundOrderPayment(input: {
  orderPaymentId: string;
  amountMinor?: number;
}): Promise<void> {
  const payment = await prisma.orderPayment.findUnique({ where: { id: input.orderPaymentId } });
  if (!payment) {
    throw new OrderPaymentError('Payment not found.', 404);
  }
  if (!(SETTLED_STATUSES as readonly string[]).includes(payment.status)) {
    throw new OrderPaymentError('Only a succeeded payment can be refunded.', 409);
  }
  if (!payment.provider || !payment.providerRef) {
    throw new OrderPaymentError('Payment has no linked provider charge to refund.', 409);
  }

  const refundableMinor = payment.amountMinor + payment.tipMinor - payment.refundedMinor;
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

  const newRefundedMinor = payment.refundedMinor + requestedMinor;
  const isFullyRefunded = newRefundedMinor >= payment.amountMinor + payment.tipMinor;

  await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      refundedMinor: newRefundedMinor,
      status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
    }
  });
}

export async function markOrderPaymentSucceededByIntent(paymentIntentId: string): Promise<void> {
  await prisma.orderPayment.updateMany({
    where: {
      provider: STRIPE_PROVIDER,
      providerRef: paymentIntentId,
      status: { notIn: ['REFUNDED', 'PARTIALLY_REFUNDED'] }
    },
    data: { status: 'SUCCEEDED' }
  });
}

export async function markOrderPaymentFailedByIntent(paymentIntentId: string): Promise<void> {
  await prisma.orderPayment.updateMany({
    where: { provider: STRIPE_PROVIDER, providerRef: paymentIntentId, status: 'PENDING' },
    data: { status: 'FAILED' }
  });
}
