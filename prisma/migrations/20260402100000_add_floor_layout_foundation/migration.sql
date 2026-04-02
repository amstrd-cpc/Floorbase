-- CreateEnum
CREATE TYPE "FloorLayoutStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "FloorLayout" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "status" "FloorLayoutStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "canvasWidth" INTEGER NOT NULL DEFAULT 1600,
    "canvasHeight" INTEGER NOT NULL DEFAULT 900,
    "gridSize" INTEGER NOT NULL DEFAULT 24,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "publishedFromLayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FloorLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorLayoutArea" (
    "id" TEXT NOT NULL,
    "floorLayoutId" TEXT NOT NULL,
    "areaId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FloorLayoutArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorLayoutTable" (
    "id" TEXT NOT NULL,
    "floorLayoutId" TEXT NOT NULL,
    "floorLayoutAreaId" TEXT,
    "tableId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacityMin" INTEGER,
    "capacityMax" INTEGER NOT NULL,
    "shape" "TableShape" NOT NULL DEFAULT 'SQUARE',
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 96,
    "height" INTEGER NOT NULL DEFAULT 96,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "combinableMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FloorLayoutTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorLayout_venueId_status_version_key" ON "FloorLayout"("venueId", "status", "version");
CREATE INDEX "FloorLayout_venueId_status_isCurrent_idx" ON "FloorLayout"("venueId", "status", "isCurrent");
CREATE INDEX "FloorLayoutArea_floorLayoutId_idx" ON "FloorLayoutArea"("floorLayoutId");
CREATE INDEX "FloorLayoutArea_areaId_idx" ON "FloorLayoutArea"("areaId");
CREATE UNIQUE INDEX "FloorLayoutTable_floorLayoutId_tableId_key" ON "FloorLayoutTable"("floorLayoutId", "tableId");
CREATE INDEX "FloorLayoutTable_floorLayoutId_idx" ON "FloorLayoutTable"("floorLayoutId");
CREATE INDEX "FloorLayoutTable_floorLayoutAreaId_idx" ON "FloorLayoutTable"("floorLayoutAreaId");
CREATE INDEX "FloorLayoutTable_tableId_idx" ON "FloorLayoutTable"("tableId");

-- AddForeignKey
ALTER TABLE "FloorLayout" ADD CONSTRAINT "FloorLayout_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FloorLayout" ADD CONSTRAINT "FloorLayout_publishedFromLayoutId_fkey" FOREIGN KEY ("publishedFromLayoutId") REFERENCES "FloorLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FloorLayoutArea" ADD CONSTRAINT "FloorLayoutArea_floorLayoutId_fkey" FOREIGN KEY ("floorLayoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FloorLayoutArea" ADD CONSTRAINT "FloorLayoutArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FloorLayoutTable" ADD CONSTRAINT "FloorLayoutTable_floorLayoutId_fkey" FOREIGN KEY ("floorLayoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FloorLayoutTable" ADD CONSTRAINT "FloorLayoutTable_floorLayoutAreaId_fkey" FOREIGN KEY ("floorLayoutAreaId") REFERENCES "FloorLayoutArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FloorLayoutTable" ADD CONSTRAINT "FloorLayoutTable_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
