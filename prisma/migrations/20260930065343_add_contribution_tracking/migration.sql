-- Contribution ("Mchango") tracking for reminders + the public tracker page.

-- Per-event contribution fields that feed the approved "Mchango" WhatsApp template.
ALTER TABLE "Event" ADD COLUMN "eventType" TEXT;
ALTER TABLE "Event" ADD COLUMN "contributionDeadline" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "mpesaInstructions" TEXT;
ALTER TABLE "Event" ADD COLUMN "airtelInstructions" TEXT;
ALTER TABLE "Event" ADD COLUMN "bankInstructions" TEXT;
ALTER TABLE "Event" ADD COLUMN "contributionTarget" INTEGER;
ALTER TABLE "Event" ADD COLUMN "contributionCurrency" TEXT DEFAULT 'TZS';
ALTER TABLE "Event" ADD COLUMN "contributionsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- One row per guest. Created on first reminder so the tracker lists only
-- guests who were actually asked to contribute.
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "amountExpected" INTEGER,
    "note" TEXT,
    "updatedByName" TEXT,
    "remindedAt" TIMESTAMP(3),
    "remindedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contribution_guestId_key" ON "Contribution"("guestId");
CREATE INDEX "Contribution_eventId_status_idx" ON "Contribution"("eventId", "status");

ALTER TABLE "Contribution"
    ADD CONSTRAINT "Contribution_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contribution"
    ADD CONSTRAINT "Contribution_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
