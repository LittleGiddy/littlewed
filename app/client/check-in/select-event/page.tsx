import EventSelector from '@/app/components/EventSelector';

export default function CheckInSelectEventPage() {
  return (
    <EventSelector
      title="Check-in Guests"
      description="Choose the event you want to check guests into."
      backUrl="/client/dashboard"
      actionLabel="Check In"
      actionBase="/client/check-in"
    />
  );
}
