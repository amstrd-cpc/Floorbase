import { getStripe } from '@/server/billing/stripe';
import { prisma } from '@/server/db/prisma/client';
import { DepositError } from './errors';

const STRIPE_PROVIDER = 'stripe';

export async function createDepositPaymentIntent(input: {
  venueSlug: string;
  reservationId: string;
}): Promise<{ clientSecret: string; amountMinor: number; currency: string }> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, venue: { slug: input.venueSlug } },
    select: {
      id: true,
      deposit: {
        select: {
          id: true,
          amountMinor: true,
          currency: true,
          status: true,
          provider: true,
          providerRef: true
        }
      }
    }
  });

  const deposit = reservation?.deposit;
  if (!reservation || !deposit) {
    throw new DepositError('No deposit is required for this reservation.', 404);
  }

  if (deposit.status === 'PAID') {
    throw new DepositError('This deposit has already been paid.', 409);
  }

  const stripe = getStripe();

  // Re-use an existing, still-open PaymentIntent rather than creating a
  // duplicate charge attempt if the guest reloads the payment page.
  if (deposit.provider === STRIPE_PROVIDER && deposit.providerRef) {
    const existing = await stripe.paymentIntents.retrieve(deposit.providerRef);
    if (existing.status !== 'canceled' && existing.client_secret) {
      return {
        clientSecret: existing.client_secret,
        amountMinor: deposit.amountMinor,
        currency: deposit.currency
      };
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: deposit.amountMinor,
    currency: deposit.currency.toLowerCase(),
    metadata: { reservationId: reservation.id, depositId: deposit.id },
    automatic_payment_methods: { enabled: true }
  });

  if (!paymentIntent.client_secret) {
    throw new DepositError('Stripe did not return a payment secret.', 502);
  }

  await prisma.deposit.update({
    where: { id: deposit.id },
    data: { provider: STRIPE_PROVIDER, providerRef: paymentIntent.id }
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amountMinor: deposit.amountMinor,
    currency: deposit.currency
  };
}

export async function markDepositPaidByPaymentIntent(
  paymentIntentId: string
): Promise<void> {
  await prisma.deposit.updateMany({
    where: { provider: STRIPE_PROVIDER, providerRef: paymentIntentId },
    data: { status: 'PAID', paidAt: new Date() }
  });
}

export async function markDepositFailedByPaymentIntent(
  paymentIntentId: string
): Promise<void> {
  await prisma.deposit.updateMany({
    where: {
      provider: STRIPE_PROVIDER,
      providerRef: paymentIntentId,
      status: { not: 'PAID' }
    },
    data: { status: 'FAILED' }
  });
}
