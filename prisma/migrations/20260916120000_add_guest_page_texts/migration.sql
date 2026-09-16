-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "guestPageDetailsTitle" TEXT DEFAULT 'The Invitation',
ADD COLUMN     "guestPageRsvpTitle" TEXT DEFAULT 'Will You Attend?',
ADD COLUMN     "guestPageFooterNote" TEXT DEFAULT 'With love';