-- CreateEnum
CREATE TYPE "VenuePlacementMode" AS ENUM ('AUTO_ASSIGN', 'TABLE_SELECTION');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('SINGLE_DATE', 'WEEKLY_RECURRING', 'DATE_RANGE');

-- AlterTable
ALTER TABLE "Venue"
ADD COLUMN "placementMode" "VenuePlacementMode" NOT NULL DEFAULT 'AUTO_ASSIGN',
ADD COLUMN "minPartySize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "publicInstructions" TEXT;

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "eventType" "BookingEventType" NOT NULL,
    "singleDate" TIMESTAMP(3),
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "confirmationMode" "VenueBookingMode",
    "placementMode" "VenuePlacementMode",
    "minPartySize" INTEGER,
    "maxOnlinePartySize" INTEGER,
    "minAdvanceNoticeMinutes" INTEGER,
    "maxDaysAhead" INTEGER,
    "durationMinutes" INTEGER,
    "publicInstructions" TEXT,
    "publicLabel" TEXT,
    "allowedAreaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedTableIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingEvent_venueId_isActive_priority_idx" ON "BookingEvent"("venueId", "isActive", "priority");

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
