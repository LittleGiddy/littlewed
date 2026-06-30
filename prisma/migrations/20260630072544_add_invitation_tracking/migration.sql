-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "invitationDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "invitationOpenedAt" TIMESTAMP(3),
ADD COLUMN     "invitationSentAt" TIMESTAMP(3);
