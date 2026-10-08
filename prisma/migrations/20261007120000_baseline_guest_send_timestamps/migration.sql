-- Repair: these two columns were added to the database out-of-band, so the
-- migration history drifted. Re-declaring them (idempotently) brings the
-- expected schema back in sync with the live database.
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "smsSentAt" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "whatsappSentAt" TIMESTAMP(3);
