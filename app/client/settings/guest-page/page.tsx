'use client';

import GuestPageThemeEditor from '@/app/components/GuestPageThemeEditor';

export default function GuestPageSettings() {
  return (
    <GuestPageThemeEditor
      apiUrl="/api/tenant/settings"
      uploadUrl="/api/tenant/upload-guest-page-header"
      backHref="/client/settings"
      title="Guest Page Theme"
      description="Default look applying to every event. Each event can override these — open an event and choose &quot;Guest Page &amp; Invitation&quot;."
      draftKey="guest_page_theme"
    />
  );
}