-- CreateEnum
CREATE TYPE "BookingLifecycleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "BookingEvent" DROP COLUMN "priority";

-- Normalize reservation status code spelling for cancelled.
UPDATE "ReservationStatus"
SET "code" = 'CANCELLED',
    "label" = CASE WHEN "label" = 'Canceled' THEN 'Cancelled' ELSE "label" END
WHERE "code" = 'CANCELED';

-- AlterTable
ALTER TABLE "Reservation"
ADD COLUMN "bookingStatus" "BookingLifecycleStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- Backfill booking lifecycle from existing reservation status codes.
UPDATE "Reservation" AS r
SET "bookingStatus" = CASE UPPER(s."code")
  WHEN 'PENDING' THEN 'PENDING'::"BookingLifecycleStatus"
  WHEN 'CONFIRMED' THEN 'CONFIRMED'::"BookingLifecycleStatus"
  WHEN 'SEATED' THEN 'SEATED'::"BookingLifecycleStatus"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"BookingLifecycleStatus"
  WHEN 'NO_SHOW' THEN 'NO_SHOW'::"BookingLifecycleStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"BookingLifecycleStatus"
  WHEN 'CANCELED' THEN 'CANCELLED'::"BookingLifecycleStatus"
  ELSE 'PENDING'::"BookingLifecycleStatus"
END
FROM "ReservationStatus" AS s
WHERE r."reservationStatusId" = s."id";

-- CreateIndex
CREATE INDEX "Reservation_bookingStatus_idx" ON "Reservation"("bookingStatus");

-- CreateIndex
CREATE INDEX "Reservation_paymentStatus_idx" ON "Reservation"("paymentStatus");
