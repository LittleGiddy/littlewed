/*
  Warnings:

  - A unique constraint covering the columns `[passCode]` on the table `Guest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "passCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Guest_passCode_key" ON "Guest"("passCode");

-- CreateIndex
CREATE INDEX "Guest_passCode_idx" ON "Guest"("passCode");
