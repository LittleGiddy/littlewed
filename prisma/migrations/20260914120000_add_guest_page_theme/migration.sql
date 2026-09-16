-- AlterTable: Add guest invitation page (invite link) theme customization
ALTER TABLE "Tenant" ADD COLUMN     "guestPagePrimaryColor" TEXT DEFAULT '#BE185D',
ADD COLUMN     "guestPageSecondaryColor" TEXT DEFAULT '#6D28D9',
ADD COLUMN     "guestPageAccentColor" TEXT DEFAULT '#F6C445',
ADD COLUMN     "guestPageFontFamily" TEXT DEFAULT 'Playfair Display',
ADD COLUMN     "guestPageHeaderImage" TEXT,
ADD COLUMN     "guestPageTitle" TEXT,
ADD COLUMN     "guestPageSubtitle" TEXT;