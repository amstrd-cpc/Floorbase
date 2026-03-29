-- CreateTable
CREATE TABLE "TableBlock" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableBlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TableBlock"
ADD CONSTRAINT "TableBlock_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TableBlock_tableId_idx" ON "TableBlock"("tableId");
CREATE INDEX "TableBlock_startsAt_endsAt_idx" ON "TableBlock"("startsAt", "endsAt");
