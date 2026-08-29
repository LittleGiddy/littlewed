-- Add activeSessionId for single-device session enforcement (CLIENT/STAFF)
ALTER TABLE "User" ADD COLUMN "activeSessionId" TEXT;