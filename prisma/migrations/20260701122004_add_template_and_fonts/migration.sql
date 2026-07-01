-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "dateFontFamily" TEXT DEFAULT 'DM Sans',
ADD COLUMN     "eventNameFontFamily" TEXT DEFAULT 'Playfair Display',
ADD COLUMN     "nameFontFamily" TEXT DEFAULT 'Playfair Display',
ADD COLUMN     "venueFontFamily" TEXT DEFAULT 'DM Sans';

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
