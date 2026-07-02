import EventSelector from '@/app/components/EventSelector';

export default function ImportSelectEventPage() {
  return (
    <EventSelector
      title="Import Guests"
      description="Choose the event you want to import guests into."
      backUrl="/client/dashboard"
      actionLabel="Import Guests"
      actionBase="/client/guests/import"
    />
  );
}