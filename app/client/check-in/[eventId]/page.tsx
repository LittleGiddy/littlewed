'use client';
import { use } from 'react';
import CheckInView from '../CheckInView';

export default function CheckInEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return <CheckInView eventId={eventId} />;
}
