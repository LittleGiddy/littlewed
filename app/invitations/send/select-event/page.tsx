import EventSelector from '@/app/components/EventSelector';

export default function SendSelectEventPage() {
  return (
    <EventSelector
      title="Send Invitations"
      description="Choose the event you want to send invitations for."
      backUrl="/client/dashboard"
      actionLabel="Send Invites"
      actionBase="/client/invitations/send"
    />
  );
}