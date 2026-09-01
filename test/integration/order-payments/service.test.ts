import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let prisma: PrismaClient;
let teardown: () => Promise<void>;

let createOrder: typeof import('@/server/orders/service').createOrder;
let addOrderLine: typeof import('@/server/orders/service').addOrderLine;
let closeOrder: typeof import('@/server/orders/service').closeOrder;
let computeOrderPaymentSummary: typeof import('@/server/order-payments/service').computeOrderPaymentSummary;
let computeRefundSplit: typeof import('@/server/order-payments/service').computeRefundSplit;
let createOrderPaymentIntent: typeof import('@/server/order-payments/service').createOrderPaymentIntent;
let refundOrderPayment: typeof import('@/server/order-payments/service').refundOrderPayment;
let markOrderPaymentSucceededByIntent: typeof import('@/server/order-payments/service').markOrderPaymentSucceededByIntent;
let markOrderPaymentFailedByIntent: typeof import('@/server/order-payments/service').markOrderPaymentFailedByIntent;
let OrderPaymentError: typeof import('@/server/order-payments/errors').OrderPaymentError;

before(async () => {
  const db = await setupTestDatabase();
  prisma = db.prisma;
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;
  // order-payments/service pulls in @/server/billing/stripe -> @/env, which
  // parses process.env eagerly at import time and requires this.
  process.env.AUTH_SESSION_SECRET ??= 'kQ7z2XpL9mR4vB8nT1yC6wF3hJ0sA5dE';

  const ordersService = await import('@/server/orders/service');
  const paymentsService = await import('@/server/order-payments/service');
  const errors = await import('@/server/order-payments/errors');

  createOrder = ordersService.createOrder;
  addOrderLine = ordersService.addOrderLine;
  closeOrder = ordersService.closeOrder;
  computeOrderPaymentSummary = paymentsService.computeOrderPaymentSummary;
  computeRefundSplit = paymentsService.computeRefundSplit;
  createOrderPaymentIntent = paymentsService.createOrderPaymentIntent;
  refundOrderPayment = paymentsService.refundOrderPayment;
  markOrderPaymentSucceededByIntent =
    paymentsService.markOrderPaymentSucceededByIntent;
  markOrderPaymentFailedByIntent =
    paymentsService.markOrderPaymentFailedByIntent;
  OrderPaymentError = errors.OrderPaymentError;
});

after(async () => {
  await teardown();
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedOrderWithLine(priceMinor = 1000) {
  const suffix = uniqueSuffix();
  const organization = await prisma.organization.create({
    data: {
      name: 'Order Payments Test Org',
      slug: `order-payments-org-${suffix}`
    }
  });
  const venue = await prisma.venue.create({
    data: {
      organizationId: organization.id,
      name: 'Order Payments Test Venue',
      slug: `order-payments-venue-${suffix}`,
      timezone: 'UTC',
      currency: 'USD',
      isActive: true
    }
  });
  const category = await prisma.menuCategory.create({
    data: { venueId: venue.id, name: 'Mains', isActive: true }
  });
  const menuItem = await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId: category.id,
      name: 'Burger',
      priceMinor,
      isActive: true
    }
  });

  const order = await createOrder({ payload: { venueId: venue.id } });
  await addOrderLine({
    orderId: order.id,
    payload: { menuItemId: menuItem.id, quantity: 1 }
  });

  return order;
}

test('computeOrderPaymentSummary sums lines and only counts settled payments toward the balance', () => {
  const lines = [{ priceMinorSnapshot: 1000, quantity: 2 }]; // total 2000
  const payments = [
    { status: 'PENDING', amountMinor: 500, tipMinor: 0, refundedMinor: 0 },
    { status: 'FAILED', amountMinor: 500, tipMinor: 0, refundedMinor: 0 },
    { status: 'SUCCEEDED', amountMinor: 800, tipMinor: 100, refundedMinor: 0 },
    {
      status: 'PARTIALLY_REFUNDED',
      amountMinor: 400,
      tipMinor: 0,
      refundedMinor: 100
    }
  ];

  const summary = computeOrderPaymentSummary({ lines, payments });

  assert.equal(summary.orderTotalMinor, 2000);
  // 800 (fully settled) + (400 - 100 refunded) = 1100; PENDING/FAILED excluded
  assert.equal(summary.paidTowardOrderMinor, 1100);
  assert.equal(summary.remainingMinor, 900);
});

test('computeRefundSplit draws from the tip before the order amount, and tracks them separately', () => {
  // $10.00 order portion + $2.00 tip, nothing refunded yet
  const base = {
    amountMinor: 1000,
    tipMinor: 200,
    refundedMinor: 0,
    refundedTipMinor: 0
  };

  const tipOnly = computeRefundSplit({ ...base, requestedMinor: 200 });
  assert.equal(
    tipOnly.newRefundedMinor,
    0,
    'order portion must be untouched by a tip-only refund'
  );
  assert.equal(tipOnly.newRefundedTipMinor, 200);
  assert.equal(tipOnly.isFullyRefunded, false); // order portion still owed
  assert.equal(tipOnly.refundableMinor, 1200);

  const afterTipRefunded = { ...base, refundedTipMinor: 200 };
  const orderPortion = computeRefundSplit({
    ...afterTipRefunded,
    requestedMinor: 500
  });
  assert.equal(orderPortion.newRefundedMinor, 500);
  assert.equal(orderPortion.newRefundedTipMinor, 200);

  const full = computeRefundSplit({
    ...afterTipRefunded,
    requestedMinor: 1000
  });
  assert.equal(full.newRefundedMinor, 1000);
  assert.equal(full.isFullyRefunded, true);
});

test('createOrderPaymentIntent counts an existing PENDING payment toward the reserved balance', async () => {
  const order = await seedOrderWithLine(1000); // order total 1000
  await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 700,
      status: 'PENDING',
      provider: 'stripe'
    }
  });

  // remaining should be 1000 - 700 (reserved) = 300; 400 must be rejected
  await assert.rejects(
    () => createOrderPaymentIntent({ orderId: order.id, amountMinor: 400 }),
    (error: unknown) => error instanceof OrderPaymentError
  );
});

test('createOrderPaymentIntent rejects a non-positive amount before touching the DB', async () => {
  await assert.rejects(
    () =>
      createOrderPaymentIntent({
        orderId: 'cnonexistentorderid000001',
        amountMinor: 0
      }),
    (error: unknown) => error instanceof OrderPaymentError
  );
});

test('createOrderPaymentIntent throws 404 for an unknown order', async () => {
  await assert.rejects(
    () =>
      createOrderPaymentIntent({
        orderId: 'cnonexistentorderid000002',
        amountMinor: 500
      }),
    (error: unknown) =>
      error instanceof OrderPaymentError && error.status === 404
  );
});

test('createOrderPaymentIntent rejects a closed order', async () => {
  const order = await seedOrderWithLine();
  await closeOrder({ orderId: order.id });

  await assert.rejects(
    () => createOrderPaymentIntent({ orderId: order.id, amountMinor: 500 }),
    (error: unknown) =>
      error instanceof OrderPaymentError && error.status === 409
  );
});

test('createOrderPaymentIntent rejects an amount above the remaining balance', async () => {
  const order = await seedOrderWithLine(1000);

  await assert.rejects(
    () => createOrderPaymentIntent({ orderId: order.id, amountMinor: 5000 }),
    (error: unknown) => error instanceof OrderPaymentError
  );
});

test('refundOrderPayment throws 404 for an unknown payment', async () => {
  await assert.rejects(
    () => refundOrderPayment({ orderPaymentId: 'cnonexistentpaymentid001' }),
    (error: unknown) =>
      error instanceof OrderPaymentError && error.status === 404
  );
});

test('refundOrderPayment rejects a payment that never succeeded', async () => {
  const order = await seedOrderWithLine();
  const payment = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      provider: 'stripe',
      providerRef: 'pi_never_succeeded'
    }
  });

  await assert.rejects(
    () => refundOrderPayment({ orderPaymentId: payment.id }),
    (error: unknown) =>
      error instanceof OrderPaymentError && error.status === 409
  );
});

test('refundOrderPayment rejects an amount above what is refundable', async () => {
  const order = await seedOrderWithLine();
  const payment = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      tipMinor: 100,
      status: 'SUCCEEDED',
      provider: 'stripe',
      providerRef: 'pi_succeeded_001'
    }
  });

  await assert.rejects(
    () => refundOrderPayment({ orderPaymentId: payment.id, amountMinor: 1000 }),
    (error: unknown) => error instanceof OrderPaymentError
  );
});

test('markOrderPaymentSucceededByIntent moves PENDING to SUCCEEDED but never regresses a refund', async () => {
  const order = await seedOrderWithLine();
  const pending = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      provider: 'stripe',
      providerRef: 'pi_pending_001'
    }
  });
  const refunded = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      status: 'REFUNDED',
      refundedMinor: 500,
      provider: 'stripe',
      providerRef: 'pi_refunded_001'
    }
  });

  await markOrderPaymentSucceededByIntent('pi_pending_001');
  await markOrderPaymentSucceededByIntent('pi_refunded_001');

  const pendingAfter = await prisma.orderPayment.findUniqueOrThrow({
    where: { id: pending.id }
  });
  const refundedAfter = await prisma.orderPayment.findUniqueOrThrow({
    where: { id: refunded.id }
  });
  assert.equal(pendingAfter.status, 'SUCCEEDED');
  assert.equal(
    refundedAfter.status,
    'REFUNDED',
    'a stale succeeded webhook must not un-refund a payment'
  );
});

test('markOrderPaymentFailedByIntent moves PENDING to FAILED but leaves SUCCEEDED alone', async () => {
  const order = await seedOrderWithLine();
  const pending = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      provider: 'stripe',
      providerRef: 'pi_pending_002'
    }
  });
  const succeeded = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      amountMinor: 500,
      status: 'SUCCEEDED',
      provider: 'stripe',
      providerRef: 'pi_succeeded_002'
    }
  });

  await markOrderPaymentFailedByIntent('pi_pending_002');
  await markOrderPaymentFailedByIntent('pi_succeeded_002');

  const pendingAfter = await prisma.orderPayment.findUniqueOrThrow({
    where: { id: pending.id }
  });
  const succeededAfter = await prisma.orderPayment.findUniqueOrThrow({
    where: { id: succeeded.id }
  });
  assert.equal(pendingAfter.status, 'FAILED');
  assert.equal(
    succeededAfter.status,
    'SUCCEEDED',
    'a stale failure webhook must not downgrade a succeeded payment'
  );
});
