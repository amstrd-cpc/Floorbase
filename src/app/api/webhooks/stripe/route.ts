import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { getStripe } from '@/server/billing/stripe';
import { syncSubscription } from '@/server/billing/service';
import { prisma } from '@/server/db/prisma/client';
import { env } from '@/env';

// Disable body parsing so we can read raw bytes for signature verification.
export const dynamic = 'force-dynamic';

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  await syncSubscription(subscription);
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );
  await syncSubscription(subscription);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  if (!orgId || !session.subscription || !session.customer) return;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      stripeCustomerId: session.customer as string,
      subscriptionId: session.subscription as string,
      subscriptionStatus: 'ACTIVE',
    },
  });
}

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Webhook not configured.' },
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
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature.' },
      { status: 400 }
    );
  }

  // Idempotency: skip already-processed events. Use try-catch on create
  // rather than find-then-create to avoid race conditions.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ ok: true });
    }
    throw e;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook handler failed for event ${event.id}`, error);
    // Return 500 so Stripe retries the event.
    return NextResponse.json(
      { error: 'Webhook handler failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
