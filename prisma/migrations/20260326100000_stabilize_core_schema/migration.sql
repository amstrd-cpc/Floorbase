-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('PHONE', 'WEBSITE', 'WIDGET', 'WALK_IN', 'MANUAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'REFUNDED', 'FAILED', 'WAIVED');

-- Drop legacy membership model (not used by auth checks)
DROP TABLE IF EXISTS "Membership";
DROP TYPE IF EXISTS "MembershipRole";

-- Migrate weakly typed text fields to enums
ALTER TABLE "Reservation"
  ALTER COLUMN "source" TYPE "ReservationSource"
  USING (
    CASE
      WHEN "source" IS NULL THEN NULL
      WHEN upper(replace("source", '-', '_')) = 'PHONE' THEN 'PHONE'::"ReservationSource"
      WHEN upper(replace("source", '-', '_')) = 'WEBSITE' THEN 'WEBSITE'::"ReservationSource"
      WHEN upper(replace("source", '-', '_')) = 'WIDGET' THEN 'WIDGET'::"ReservationSource"
      WHEN upper(replace("source", '-', '_')) = 'WALK_IN' THEN 'WALK_IN'::"ReservationSource"
      WHEN upper(replace("source", '-', '_')) = 'MANUAL' THEN 'MANUAL'::"ReservationSource"
      WHEN upper(replace("source", '-', '_')) = 'INTERNAL' THEN 'INTERNAL'::"ReservationSource"
      ELSE NULL
    END
  );

ALTER TABLE "Deposit"
  ALTER COLUMN "status" TYPE "DepositStatus"
  USING (
    CASE
      WHEN upper("status") = 'AUTHORIZED' THEN 'AUTHORIZED'::"DepositStatus"
      WHEN upper("status") = 'PAID' THEN 'PAID'::"DepositStatus"
      WHEN upper("status") = 'REFUNDED' THEN 'REFUNDED'::"DepositStatus"
      WHEN upper("status") = 'FAILED' THEN 'FAILED'::"DepositStatus"
      WHEN upper("status") = 'WAIVED' THEN 'WAIVED'::"DepositStatus"
      ELSE 'PENDING'::"DepositStatus"
    END
  );

-- Core integrity constraints
ALTER TABLE "Table"
  ADD CONSTRAINT "Table_capacity_max_positive" CHECK ("capacityMax" > 0),
  ADD CONSTRAINT "Table_capacity_min_valid" CHECK ("capacityMin" IS NULL OR ("capacityMin" > 0 AND "capacityMin" <= "capacityMax"));

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_party_size_positive" CHECK ("partySize" > 0),
  ADD CONSTRAINT "Reservation_time_window_valid" CHECK ("endAt" > "startAt");

ALTER TABLE "BusinessHours"
  ADD CONSTRAINT "BusinessHours_day_of_week_range" CHECK ("dayOfWeek" BETWEEN 0 AND 6);

ALTER TABLE "BlackoutRule"
  ADD CONSTRAINT "BlackoutRule_time_window_valid" CHECK ("endsAt" > "startsAt");

ALTER TABLE "Deposit"
  ADD CONSTRAINT "Deposit_amount_minor_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "Deposit_currency_code_length" CHECK (char_length("currency") = 3);

ALTER TABLE "AuthInvite"
  ADD CONSTRAINT "AuthInvite_super_admin_scope" CHECK (
    ("role" = 'SUPER_ADMIN' AND "organizationId" IS NULL AND "venueId" IS NULL)
    OR ("role" <> 'SUPER_ADMIN' AND "organizationId" IS NOT NULL)
  );

ALTER TABLE "AdminRoleAssignment"
  ADD CONSTRAINT "AdminRoleAssignment_super_admin_scope" CHECK (
    ("role" = 'SUPER_ADMIN' AND "organizationId" IS NULL AND "venueId" IS NULL)
    OR ("role" <> 'SUPER_ADMIN' AND "organizationId" IS NOT NULL)
  );

-- Practical indexes
CREATE UNIQUE INDEX "ReservationStatus_one_default_per_org_idx"
  ON "ReservationStatus" ("organizationId")
  WHERE "isDefault" = true;

CREATE INDEX "Guest_org_email_idx"
  ON "Guest" ("organizationId", lower("email"))
  WHERE "email" IS NOT NULL;

CREATE INDEX "User_email_lower_idx"
  ON "User" (lower("email"));
