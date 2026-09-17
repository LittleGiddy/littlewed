'use client';

import GuestPageThemeEditor from '@/app/components/GuestPageThemeEditor';

export default function GuestPageSettings() {
  return (
    <GuestPageThemeEditor
      apiUrl="/api/tenant/settings"
      uploadUrl="/api/tenant/upload-guest-page-header"
      backHref="/client/settings"
      title="Guest Page Theme"
      description="Choose a default look for all events, or pick one event below to give it its own invitation look."
      draftKey="guest_page_theme"
      enableEventSelect
    />
  );
}