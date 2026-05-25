-- AlterTable: add stripeCustomerId; make subscriptionId unique (column added in prior migration)
ALTER TABLE "Organization"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD CONSTRAINT "Organization_stripeCustomerId_key" UNIQUE ("stripeCustomerId");

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_subscriptionId_key" UNIQUE ("subscriptionId");

-- CreateTable: idempotency log for Stripe webhook events
CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
