import EventSelector from '@/app/components/EventSelector';

export default function DesignSelectEventPage() {
  return (
    <EventSelector
      title="Design a Card"
      description="Choose the event you want to design an invitation card for."
      backUrl="/client/dashboard"
      actionLabel="Design Card"
      actionBase="/client/invitations/design"
    />
  );
}