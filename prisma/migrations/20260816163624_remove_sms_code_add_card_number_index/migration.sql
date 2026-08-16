/*
  Warnings:

  - You are about to drop the column `smsCode` on the `Guest` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Guest_smsCode_idx";

-- DropIndex
DROP INDEX "Guest_smsCode_key";

-- AlterTable
ALTER TABLE "Guest" DROP COLUMN "smsCode";

-- CreateIndex
CREATE INDEX "Guest_cardNumber_idx" ON "Guest"("cardNumber");
