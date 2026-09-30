'use client';
import { useSearchParams } from 'next/navigation';
import CheckInView from './CheckInView';

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');

  return <CheckInView eventId={eventId} />;
}
