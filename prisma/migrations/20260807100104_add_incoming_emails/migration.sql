-- CreateTable
CREATE TABLE "IncomingEmail" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "messageId" TEXT,
    "repliedTo" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT,
    "guestId" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IncomingEmail_pkey" PRIMARY KEY ("id")
);
