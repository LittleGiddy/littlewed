-- Add guestCount for FAMILIA/WAKWE group guests (determines allowed scans)
ALTER TABLE "Guest" ADD COLUMN "guestCount" INTEGER;