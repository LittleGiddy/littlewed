-- Tenant: new defaults for guest invitation pages
ALTER TABLE "Tenant"
ADD COLUMN     "guestPageThemeColor" TEXT DEFAULT '#E8C46B',
ADD COLUMN     "guestPageCoupleImage" TEXT;

-- Event: per-event guest invitation page settings
ALTER TABLE "Event"
ADD COLUMN     "guestPagePrimaryColor" TEXT DEFAULT '#BE185D',
ADD COLUMN     "guestPageSecondaryColor" TEXT DEFAULT '#6D28D9',
ADD COLUMN     "guestPageAccentColor" TEXT DEFAULT '#F6C445',
ADD COLUMN     "guestPageThemeColor" TEXT DEFAULT '#E8C46B',
ADD COLUMN     "guestPageFontFamily" TEXT DEFAULT 'Playfair Display',
ADD COLUMN     "guestPageHeaderImage" TEXT,
ADD COLUMN     "guestPageCoupleImage" TEXT,
ADD COLUMN     "guestPageTitle" TEXT,
ADD COLUMN     "guestPageSubtitle" TEXT,
ADD COLUMN     "guestPageDetailsTitle" TEXT DEFAULT 'The Invitation',
ADD COLUMN     "guestPageRsvpTitle" TEXT DEFAULT 'Will You Attend?',
ADD COLUMN     "guestPageFooterNote" TEXT DEFAULT 'With love';

-- Backfill existing events with their tenant's customized settings so every
-- event starts from the same look the tenant already configured. Only copied
-- when the tenant actually customized the value (differs from the default).
UPDATE "Event" e
SET "guestPagePrimaryColor" = t."guestPagePrimaryColor"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPagePrimaryColor" IS NOT NULL AND t."guestPagePrimaryColor" <> '#BE185D' AND e."guestPagePrimaryColor" = '#BE185D';

UPDATE "Event" e
SET "guestPageSecondaryColor" = t."guestPageSecondaryColor"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageSecondaryColor" IS NOT NULL AND t."guestPageSecondaryColor" <> '#6D28D9' AND e."guestPageSecondaryColor" = '#6D28D9';

UPDATE "Event" e
SET "guestPageAccentColor" = t."guestPageAccentColor"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageAccentColor" IS NOT NULL AND t."guestPageAccentColor" <> '#F6C445' AND e."guestPageAccentColor" = '#F6C445';

UPDATE "Event" e
SET "guestPageThemeColor" = t."guestPageThemeColor"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageThemeColor" IS NOT NULL AND t."guestPageThemeColor" <> '#E8C46B' AND e."guestPageThemeColor" = '#E8C46B';

UPDATE "Event" e
SET "guestPageFontFamily" = t."guestPageFontFamily"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageFontFamily" IS NOT NULL AND t."guestPageFontFamily" <> 'Playfair Display' AND e."guestPageFontFamily" = 'Playfair Display';

UPDATE "Event" e
SET "guestPageHeaderImage" = t."guestPageHeaderImage"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageHeaderImage" IS NOT NULL AND e."guestPageHeaderImage" IS NULL;

UPDATE "Event" e
SET "guestPageCoupleImage" = t."guestPageCoupleImage"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageCoupleImage" IS NOT NULL AND e."guestPageCoupleImage" IS NULL;

UPDATE "Event" e
SET "guestPageTitle" = t."guestPageTitle"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageTitle" IS NOT NULL AND e."guestPageTitle" IS NULL;

UPDATE "Event" e
SET "guestPageSubtitle" = t."guestPageSubtitle"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageSubtitle" IS NOT NULL AND e."guestPageSubtitle" IS NULL;

UPDATE "Event" e
SET "guestPageDetailsTitle" = t."guestPageDetailsTitle"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageDetailsTitle" IS NOT NULL AND t."guestPageDetailsTitle" <> 'The Invitation' AND e."guestPageDetailsTitle" = 'The Invitation';

UPDATE "Event" e
SET "guestPageRsvpTitle" = t."guestPageRsvpTitle"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageRsvpTitle" IS NOT NULL AND t."guestPageRsvpTitle" <> 'Will You Attend?' AND e."guestPageRsvpTitle" = 'Will You Attend?';

UPDATE "Event" e
SET "guestPageFooterNote" = t."guestPageFooterNote"
FROM "Tenant" t
WHERE e."tenantId" = t.id AND t."guestPageFooterNote" IS NOT NULL AND t."guestPageFooterNote" <> 'With love' AND e."guestPageFooterNote" = 'With love';