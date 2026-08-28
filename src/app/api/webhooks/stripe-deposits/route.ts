import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { getStripe } from '@/server/billing/stripe';
import {
  markDepositPaidByPaymentIntent,
  markDepositFailedByPaymentIntent
} from '@/server/deposits/service';
import { prisma } from '@/server/db/prisma/client';
import { env } from '@/env';

// Separate webhook endpoint from /api/webhooks/stripe (SaaS billing) — this
// one is a distinct Stripe webhook subscription for guest-facing reservation
// deposits (payment_intent.* events), with its own signing secret.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!env.STRIPE_DEPOSITS_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Deposits webhook not configured.' },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_DEPOSITS_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature.' },
      { status: 400 }
    );
  }

  // Same StripeEvent table as the billing webhook — Stripe event IDs are
  // globally unique per account regardless of which endpoint receives them,
  // so this still gives correct idempotency across both handlers.
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await markDepositPaidByPaymentIntent(
          (event.data.object as Stripe.PaymentIntent).id
        );
        break;

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await markDepositFailedByPaymentIntent(
          (event.data.object as Stripe.PaymentIntent).id
        );
        break;

      default:
        break;
    }

    await prisma.stripeEvent.create({ data: { id: event.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ ok: true });
    }
    console.error(`Stripe deposits webhook handler failed for event ${event.id}`, e);
    return NextResponse.json(
      { error: 'Webhook handler failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
