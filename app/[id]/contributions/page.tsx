// app/[id]/contributions/page.tsx
// Public contribution tracker. Shared with the event's client as
// https://littlewed.co.tz/[eventId]/contributions
//
// The folder is [id], not [eventId]: app/events/[id]/page.tsx already claims
// this dynamic level, and Next rejects two different slug names for one path.
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { summariseContributions, parseContributionStatus } from '@/lib/contributions';
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
    select: {
      id: true,
      name: true,
      eventType: true,
      date: true,
      contributionDeadline: true,
      venue: true,
      address: true,
      person1: true,
      person2: true,
      contributionCurrency: true,
      contributionTarget: true,
      // Payment instructions are deliberately NOT selected. The owner's ledger
      // records what has been received; restating the M-Pesa/Airtel/bank
      // numbers here duplicated Event Details on a page that has no reason to
      // display them, and those values belong on the event itself.
      // Every guest, not just the ones with a Contribution row, so the first
      // paint matches what /api/public/.../contributions returns. Selecting the
      // relation alone made the server-rendered list shorter than the list the
      // client fetched on the next refresh.
      guests: {
        select: {
          id: true,
          name: true,
          title: true,
          phone: true,
          contribution: {
            select: {
              id: true,
              status: true,
              amountPaid: true,
              amountExpected: true,
              note: true,
              updatedAt: true,
            },
          },
          // Matches /api/public/.../contributions: any still-unreviewed
          // proposal for this guest, so the first paint carries it too.
          editRequests: {
            where: { status: 'PENDING' },
            select: { name: true, phone: true },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  // 404 for a disabled tracker so the URL cannot be probed for existence.
  if (!event) notFound();

  const currency = event.contributionCurrency || 'TZS';
  const summary = summariseContributions(
    event.guests.map((g) => ({
      status: g.contribution?.status,
      amountPaid: g.contribution?.amountPaid ?? 0,
      amountExpected: g.contribution?.amountExpected ?? null,
    })),
    { target: event.contributionTarget, currency }
  );

  // Server-render the first paint so the page is readable before hydration and
  // so the data is correct on a cold load, then let the client take over.
  const initialData = {
    event: {
      id: event.id,
      name: event.name,
      eventType: event.eventType,
      date: formatSwahiliDate(event.date),
      venue: event.venue,
      address: event.address,
      person1: event.person1,
      person2: event.person2,
      currency,
      target: event.contributionTarget,
    },
    summary,
    rows: event.guests.map((g) => ({
      // Empty until a row exists: the guest is on the event but has not been
      // tracked yet, which is a different state from a tracked zero.
      id: g.contribution?.id ?? '',
      guestId: g.id,
      guestName: g.title ? `${g.title} ${g.name}` : g.name,
      // Raw name, without the title — the edit form binds to this.
      name: g.name,
      // The full number: this ledger belongs to the event owner, and they need
      // to recognise and call the guests they are chasing.
      phone: g.phone,
      status: parseContributionStatus(g.contribution?.status),
      amountPaid: g.contribution?.amountPaid ?? 0,
      amountExpected: g.contribution?.amountExpected ?? null,
      note: g.contribution?.note ?? null,
      updatedAt: g.contribution?.updatedAt?.toISOString() ?? null,
      pendingEdit: g.editRequests[0] ?? null,
    })),
  };

  return <ContributionTracker eventId={eventId} initialData={initialData} />;
}
