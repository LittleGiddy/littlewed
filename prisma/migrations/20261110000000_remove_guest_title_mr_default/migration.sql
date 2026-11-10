-- Guests without a title must stay NULL; the old "Mr" default injected a
-- title the user never entered. All guest-creation paths now pass an
-- explicit value (normalizeGuestTitle), so the column needs no default.
ALTER TABLE "Guest" ALTER COLUMN "title" DROP DEFAULT;
