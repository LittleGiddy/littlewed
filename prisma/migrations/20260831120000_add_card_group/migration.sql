-- AlterTable: Add cardGroupId, drop cardNumber uniqueness, add indexes
-- 1. Drop the existing unique index on cardNumber
DROP INDEX IF EXISTS "Guest_cardNumber_key";

-- 2. Add the cardGroupId column (nullable, backfilled below)
ALTER TABLE "Guest" ADD COLUMN "cardGroupId" TEXT;

-- 3. Backfill existing rows so each is its own group (group of 1)
UPDATE "Guest" SET "cardGroupId" = "id" WHERE "cardGroupId" IS NULL;

-- 4. Add the new index on cardGroupId
CREATE INDEX "Guest_cardGroupId_idx" ON "Guest"("cardGroupId");
