/*
  Warnings:

  - You are about to drop the column `creditBalance` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "qrPlacementX" DROP DEFAULT,
ALTER COLUMN "qrPlacementY" DROP DEFAULT,
ALTER COLUMN "qrSize" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "creditBalance";
