-- Create enums for richer floor metadata
CREATE TYPE "TableShape" AS ENUM ('SQUARE', 'ROUND', 'RECTANGLE', 'BOOTH', 'HIGH_TOP', 'BAR', 'COUNTER', 'CUSTOM');
CREATE TYPE "TableType" AS ENUM ('STANDARD', 'OUTDOOR', 'BAR', 'PRIVATE', 'ACCESSIBLE', 'FLEX');

-- Alter table model to include operational metadata
ALTER TABLE "Table"
ADD COLUMN "shape" "TableShape" NOT NULL DEFAULT 'SQUARE',
ADD COLUMN "tableType" "TableType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "canCombine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "combineGroup" TEXT;
