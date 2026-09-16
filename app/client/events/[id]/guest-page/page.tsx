import EventGuestPageSettings from './EventGuestPageSettings';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventGuestPageSettings eventId={id} />;
}