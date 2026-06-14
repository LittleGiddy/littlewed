-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "includeName" BOOLEAN DEFAULT false,
ADD COLUMN     "nameFontColor" TEXT DEFAULT '#000000',
ADD COLUMN     "nameFontSize" INTEGER,
ADD COLUMN     "namePlacementX" DOUBLE PRECISION,
ADD COLUMN     "namePlacementY" DOUBLE PRECISION;
