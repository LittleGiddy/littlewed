-- Optional invitee page blocks:
--   * a second contact person, so the couple can list two different people
--   * a switch to hide the Master of Ceremony card entirely
--
-- IF NOT EXISTS keeps this safe to re-run, and the columns are all nullable so
-- existing rows are untouched. guestPageShowMoc is nullable (not DEFAULT true)
-- so that "unset" stays distinguishable from "explicitly off" and an event can
-- still inherit a tenant-wide setting.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contactPerson2" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contactPerson2Phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "guestPageShowMoc" BOOLEAN;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "contactPerson2" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "contactPerson2Phone" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "guestPageShowMoc" BOOLEAN;
