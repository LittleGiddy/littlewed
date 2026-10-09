-- Staff event access: which events a STAFF account may access.
-- The tenant grants and revokes access from the Staff page; a staff member
-- sees nothing of an event (not even its name) without an explicit grant.

CREATE TABLE "EventStaffAccess" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventStaffAccess_pkey" PRIMARY KEY ("id")
);

-- Unique per event+staff pair so re-granting replaces rather than duplicates
CREATE UNIQUE INDEX "EventStaffAccess_eventId_userId_key" ON "EventStaffAccess"("eventId", "userId");

-- All lookups for a staff login go by user id
CREATE INDEX "EventStaffAccess_userId_idx" ON "EventStaffAccess"("userId");

ALTER TABLE "EventStaffAccess" ADD CONSTRAINT "EventStaffAccess_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventStaffAccess" ADD CONSTRAINT "EventStaffAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;