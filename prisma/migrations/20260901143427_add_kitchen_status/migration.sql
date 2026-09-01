-- CreateEnum
CREATE TYPE "KitchenStatus" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "kitchenStatus" "KitchenStatus" NOT NULL DEFAULT 'PENDING';
