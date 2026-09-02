-- AlterTable: Add reminder card fields for the WhatsApp reminder designer
ALTER TABLE "Event" ADD COLUMN "reminderCardUrl" TEXT,
ADD COLUMN "reminderCardNameX" DOUBLE PRECISION DEFAULT 50,
ADD COLUMN "reminderCardNameY" DOUBLE PRECISION DEFAULT 40,
ADD COLUMN "reminderCardNameSize" INTEGER DEFAULT 34,
ADD COLUMN "reminderCardNameColor" TEXT DEFAULT '#ffffff',
ADD COLUMN "reminderCardNameAlign" TEXT DEFAULT 'center',
ADD COLUMN "reminderCardNameFont" TEXT DEFAULT 'Playfair Display';