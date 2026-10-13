-- Raw WhatsApp reminder variable overrides, kept on the account so the
-- variable editor survives leaving the screen (same idea as whatsappInviteDraft).
ALTER TABLE "Event" ADD COLUMN "reminderMchangoOverrides" JSONB;