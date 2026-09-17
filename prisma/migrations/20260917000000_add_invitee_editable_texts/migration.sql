-- Add editable user-facing texts for the invitation cover and invitee page.
-- Nullable columns only - safe, non-destructive.

ALTER TABLE "Tenant" ADD COLUMN "guestPageCoverHint" TEXT DEFAULT 'Tap anywhere to open';
ALTER TABLE "Tenant" ADD COLUMN "guestPageCoverSubtitle" TEXT DEFAULT 'your invitation awaits';
ALTER TABLE "Tenant" ADD COLUMN "guestPageGreetingText" TEXT DEFAULT 'we would be honored to have you join us';
ALTER TABLE "Tenant" ADD COLUMN "guestPageThemeLabel" TEXT DEFAULT 'Wedding · Ceremony Theme';
ALTER TABLE "Tenant" ADD COLUMN "guestPageInvitationCardLabel" TEXT DEFAULT 'Your invitation card';
ALTER TABLE "Tenant" ADD COLUMN "guestPageReceptionLabel" TEXT DEFAULT 'Reception Notes';
ALTER TABLE "Tenant" ADD COLUMN "guestPageContactLabel" TEXT DEFAULT 'Contact Person';
ALTER TABLE "Tenant" ADD COLUMN "guestPageMocLabel" TEXT DEFAULT 'Master of Ceremony';
ALTER TABLE "Tenant" ADD COLUMN "guestPageMapLabel" TEXT DEFAULT 'Find the Venue';
ALTER TABLE "Tenant" ADD COLUMN "guestPageWishesTitle" TEXT DEFAULT 'Wedding Wishes';
ALTER TABLE "Tenant" ADD COLUMN "guestPageWishesHint" TEXT DEFAULT 'Leave a little love for the couple';
ALTER TABLE "Tenant" ADD COLUMN "guestPageDateLabel" TEXT DEFAULT 'Date';
ALTER TABLE "Tenant" ADD COLUMN "guestPageTimeLabel" TEXT DEFAULT 'Time';
ALTER TABLE "Tenant" ADD COLUMN "guestPageVenueLabel" TEXT DEFAULT 'Venue';
ALTER TABLE "Tenant" ADD COLUMN "guestPageRsvpHint" TEXT DEFAULT 'Kindly RSVP so we can plan for you';

ALTER TABLE "Event" ADD COLUMN "guestPageCoverHint" TEXT DEFAULT 'Tap anywhere to open';
ALTER TABLE "Event" ADD COLUMN "guestPageCoverSubtitle" TEXT DEFAULT 'your invitation awaits';
ALTER TABLE "Event" ADD COLUMN "guestPageGreetingText" TEXT DEFAULT 'we would be honored to have you join us';
ALTER TABLE "Event" ADD COLUMN "guestPageThemeLabel" TEXT DEFAULT 'Wedding · Ceremony Theme';
ALTER TABLE "Event" ADD COLUMN "guestPageInvitationCardLabel" TEXT DEFAULT 'Your invitation card';
ALTER TABLE "Event" ADD COLUMN "guestPageReceptionLabel" TEXT DEFAULT 'Reception Notes';
ALTER TABLE "Event" ADD COLUMN "guestPageContactLabel" TEXT DEFAULT 'Contact Person';
ALTER TABLE "Event" ADD COLUMN "guestPageMocLabel" TEXT DEFAULT 'Master of Ceremony';
ALTER TABLE "Event" ADD COLUMN "guestPageMapLabel" TEXT DEFAULT 'Find the Venue';
ALTER TABLE "Event" ADD COLUMN "guestPageWishesTitle" TEXT DEFAULT 'Wedding Wishes';
ALTER TABLE "Event" ADD COLUMN "guestPageWishesHint" TEXT DEFAULT 'Leave a little love for the couple';
ALTER TABLE "Event" ADD COLUMN "guestPageDateLabel" TEXT DEFAULT 'Date';
ALTER TABLE "Event" ADD COLUMN "guestPageTimeLabel" TEXT DEFAULT 'Time';
ALTER TABLE "Event" ADD COLUMN "guestPageVenueLabel" TEXT DEFAULT 'Venue';
ALTER TABLE "Event" ADD COLUMN "guestPageRsvpHint" TEXT DEFAULT 'Kindly RSVP so we can plan for you';