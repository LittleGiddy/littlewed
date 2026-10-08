-- Message drafts and composer settings, saved on the account (Event -> tenant)
-- instead of the browser that typed them.
ALTER TABLE "Event" ADD COLUMN "smsInviteTemplate" TEXT,
ADD COLUMN "whatsappInviteDraft" JSONB,
ADD COLUMN "whatsappDailyLimit" INTEGER,
ADD COLUMN "reminderSmsMessage" TEXT,
ADD COLUMN "kumbushaMessage" TEXT;
