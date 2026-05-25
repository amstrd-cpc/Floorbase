import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { prisma } from '@/server/db/prisma/client';
import { env } from '@/env';

function mapStripeStatus(
  status: Stripe.Subscription.Status
): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
  switch (status) {
    case 'trialing':            return 'TRIALING';
    case 'active':              return 'ACTIVE';
    case 'past_due':            return 'PAST_DUE';
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    default:                    return 'CANCELLED';
  }
}

export async function getActiveVenueCount(orgId: string): Promise<number> {
  return prisma.venue.count({ where: { organizationId: orgId, isActive: true } });
}

async function getOrCreateStripeCustomer(orgId: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { stripeCustomerId: true, name: true },
  });

  if (org.stripeCustomerId) return org.stripeCustomerId;

  const owner = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      adminRoles: { some: { role: 'ORGANIZATION_ADMIN', isActive: true } },
    },
    select: { email: true },
  });

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: org.name,
    email: owner?.email,
    metadata: { orgId },
  });

  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(
  orgId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<string> {
  if (!env.STRIPE_PRICE_ID) {
    throw new Error('STRIPE_PRICE_ID is not configured.');
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(orgId);
  const quantity = Math.max(1, await getActiveVenueCount(orgId));

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity }],
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    metadata: { orgId },
    subscription_data: { metadata: { orgId } },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  return session.url;
}

export async function createPortalSession(
  orgId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(orgId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function syncSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId =
    (subscription.metadata?.orgId as string | undefined) ?? null;

  if (!orgId) {
    console.warn('syncSubscription: no orgId in subscription metadata', subscription.id);
    return;
  }

  const status = mapStripeStatus(subscription.status);

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: status,
      planId: subscription.items.data[0]?.price.id ?? null,
    },
  });
}

export async function syncVenueCount(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionId: true },
  });

  if (!org?.subscriptionId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(org.subscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;

  const quantity = Math.max(1, await getActiveVenueCount(orgId));
  await stripe.subscriptionItems.update(item.id, { quantity });
}
