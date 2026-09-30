// app/[id]/contributions/page.tsx
// Public contribution tracker. Shared with the event's client as
// https://littlewed.co.tz/[eventId]/contributions
//
// The folder is [id], not [eventId]: app/events/[id]/page.tsx already claims
// this dynamic level, and Next rejects two different slug names for one path.
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  summariseContributions,
  maskPhone,
  parseContributionStatus,
} from '@/lib/contributions';
import { formatSwahiliDate } from '@/lib/whatsapp/mchango';
import ContributionTracker from './ContributionTracker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, contributionsEnabled: true },
    select: { name: true, eventType: true },
  });
  if (!event) return { title: 'Contribution tracker' };
  return {
    title: `${event.eventType || event.name} · Contributions`,
    description: 'Track who has completed their contribution.',
    // A shared link should not leak the event name into a search preview for
    // an unlisted page, but a direct open should still be titled properly.
    robots: { index: false, follow: false },
  };
}

export default async function ContributionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, contributionsEnabled: true },
    include: {
      contributions: {
        include: { guest: { select: { id: true, name: true, title: true, phone: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      },
    },
  });
  // 404 for a disabled tracker so the URL cannot be probed for existence.
  if (!event) notFound();

  const currency = event.contributionCurrency || 'TZS';
  const summary = summariseContributions(event.contributions, {
    target: event.contributionTarget,
    currency,
  });

  // Server-render the first paint so the page is readable before hydration and
  // so the data is correct on a cold load, then let the client take over.
  const initialData = {
    event: {
      id: event.id,
      name: event.name,
      eventType: event.eventType,
      date: formatSwahiliDate(event.date),
      deadline: formatSwahiliDate(event.contributionDeadline),
      venue: event.venue,
      address: event.address,
      hostFamily: event.hostFamily,
      person1: event.person1,
      person2: event.person2,
      currency,
      target: event.contributionTarget,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
    },
    summary,
    rows: event.contributions.map((c) => ({
      id: c.id,
      guestId: c.guestId,
      guestName: c.guest.title ? `${c.guest.title} ${c.guest.name}` : c.guest.name,
      // Masked. The full number is never sent to this page.
      phone: maskPhone(c.guest.phone),
      status: parseContributionStatus(c.status),
      amountPaid: c.amountPaid,
      amountExpected: c.amountExpected,
      note: c.note,
      updatedAt: c.updatedAt.toISOString(),
    })),
  };

  return <ContributionTracker eventId={eventId} initialData={initialData} />;
}
