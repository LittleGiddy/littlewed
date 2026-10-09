-- AlterTable: Single per-event QR code for cards printed outside the app
-- (guests not imported). The code is stored here, encodes into the QR, and is
-- recognised by the scanner for unlimited valid scans.
ALTER TABLE "Event" ADD COLUMN "externalQrCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_externalQrCode_key" ON "Event"("externalQrCode");