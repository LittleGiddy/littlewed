/*
  Warnings:

  - A unique constraint covering the columns `[cardNumber]` on the table `Guest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "title" TEXT DEFAULT 'Mr';

-- CreateIndex
CREATE UNIQUE INDEX "Guest_cardNumber_key" ON "Guest"("cardNumber");
