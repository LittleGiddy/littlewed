'use client';

import GuestPageThemeEditor from '@/app/components/GuestPageThemeEditor';

export default function EventGuestPageSettings({ eventId }: { eventId: string }) {
  return (
    <GuestPageThemeEditor
      apiUrl={`/api/events/${eventId}/guest-page`}
      uploadUrl={`/api/events/${eventId}/guest-page/upload`}
      backHref={`/client/events/${eventId}`}
      title="Guest Page & Invitation"
      description="This event's own invitation look. Anything you don't set falls back to the default you configured in Settings."
      draftKey={`guest_page_theme_event_${eventId}`}
    />
  );
}