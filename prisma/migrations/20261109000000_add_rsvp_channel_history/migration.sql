ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "messageId" TEXT;
ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "rawPayload" JSONB;
ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Rsvp_eventId_isCurrent_createdAt_idx" ON "Rsvp"("eventId", "isCurrent", "createdAt");
CREATE INDEX IF NOT EXISTS "Rsvp_guestId_isCurrent_idx" ON "Rsvp"("guestId", "isCurrent");
CREATE INDEX IF NOT EXISTS "Rsvp_messageId_idx" ON "Rsvp"("messageId");
