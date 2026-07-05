-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "thankYouCardUrl" TEXT,
ADD COLUMN     "thankYouMessage" TEXT,
ADD COLUMN     "thankYouMessageColor" TEXT DEFAULT '#ffffff',
ADD COLUMN     "thankYouMessageSize" INTEGER DEFAULT 32,
ADD COLUMN     "thankYouMessageX" DOUBLE PRECISION DEFAULT 50,
ADD COLUMN     "thankYouMessageY" DOUBLE PRECISION DEFAULT 50;
