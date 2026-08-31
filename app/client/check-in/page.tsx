'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import CheckInView from './CheckInView';

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const router = useRouter();

  return <CheckInView eventId={eventId} />;
}
