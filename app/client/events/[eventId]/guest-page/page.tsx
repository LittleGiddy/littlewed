import EventGuestPageSettings from './EventGuestPageSettings';

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventGuestPageSettings eventId={eventId} />;
}