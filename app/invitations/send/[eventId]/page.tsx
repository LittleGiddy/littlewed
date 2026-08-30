// app/invitations/send/[eventId]/page.tsx
// The send flow now lives at /client/invitations/send/[eventId] (which includes
// daily WhatsApp limit tracking and received/not-received logs). This legacy
// route redirects there so stale links get the new experience.
import { redirect } from 'next/navigation';

export default async function LegacySendInvitationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/client/invitations/send/${eventId}`);
}
