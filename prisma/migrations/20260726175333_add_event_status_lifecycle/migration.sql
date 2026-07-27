-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "expiredNotified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';
