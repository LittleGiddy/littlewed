-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPersonPhone" TEXT,
ADD COLUMN     "mapUrl" TEXT,
ADD COLUMN     "masterOfCeremony" TEXT,
ADD COLUMN     "themeColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "weddingTheme" TEXT;