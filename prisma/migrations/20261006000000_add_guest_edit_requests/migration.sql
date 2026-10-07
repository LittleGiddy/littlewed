-- Guest detail change requests proposed from the shared contribution tracker.
-- Nothing here touches Guest: the planner applies the proposal later.

CREATE TABLE IF NOT EXISTS "GuestEditRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestEditRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestEditRequest_eventId_status_idx" ON "GuestEditRequest"("eventId", "status");

CREATE INDEX IF NOT EXISTS "GuestEditRequest_guestId_idx" ON "GuestEditRequest"("guestId");

-- ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, so each foreign key is
-- guarded by a catalog lookup; that keeps the migration re-runnable, matching
-- the idempotent style the recent hand-written migrations use.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GuestEditRequest_eventId_fkey' AND contype = 'f'
  ) THEN
    ALTER TABLE "GuestEditRequest" ADD CONSTRAINT "GuestEditRequest_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GuestEditRequest_guestId_fkey' AND contype = 'f'
  ) THEN
    ALTER TABLE "GuestEditRequest" ADD CONSTRAINT "GuestEditRequest_guestId_fkey"
      FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
