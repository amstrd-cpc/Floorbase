-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "tipMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerRef" TEXT,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_status_idx" ON "OrderPayment"("status");

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
