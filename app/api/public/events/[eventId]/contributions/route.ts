// app/api/public/events/[eventId]/contributions/route.ts
// Public, unauthenticated read + status update for the shared tracker page at
// /[eventId]/contributions.
//
// There is no middleware in this project, so "public" simply means this route
// does not call getServerSession. That is fine for reads, but it also means a
// write here is reachable by anyone holding the link. The mitigations are:
//   - phone numbers are masked before they leave the server
//   - every write records who made it and when, so the tenant can see changes
//   - writes only ever move a guest between known statuses
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseContributionStatus,
  reconcileContribution,
  summariseContributions,
  maskPhone,
  formatTZS,
} from '@/lib/contributions';
import { formatSwahiliDate } from '@/lib/whatsapp/mchango';

type Ctx = { params: Promise<{ eventId: string }> };

async function loadPublicEvent(eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, contributionsEnabled: true },
    select: {
      id: true,
      name: true,
      eventType: true,
      date: true,
      contributionDeadline: true,
      venue: true,
      address: true,
      hostFamily: true,
      person1: true,
      person2: true,
      contributionTarget: true,
      contributionCurrency: true,
      mpesaInstructions: true,
      airtelInstructions: true,
      bankInstructions: true,
      // Every guest on the event, not only the ones with a Contribution row.
      // A row appears once a reminder has been sent, so selecting on the
      // relation alone hid guests who had never been reminded — and the public
      // tracker is shared, so a missing guest looked like a missing person.
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
        },
        orderBy: { name: 'asc' },
      },
    },
  });
}

function publicPayload(event: NonNullable<Awaited<ReturnType<typeof loadPublicEvent>>>) {
  const summary = summariseContributions(
    event.guests.map((g) => ({
      status: g.contribution?.status,
      amountPaid: g.contribution?.amountPaid ?? 0,
      amountExpected: g.contribution?.amountExpected ?? null,
    })),
    { target: event.contributionTarget, currency: event.contributionCurrency }
  );

  return {
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
      currency: event.contributionCurrency || 'TZS',
      target: event.contributionTarget,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
    },
    summary,
    rows: event.guests.map((g) => ({
      id: g.contribution?.id ?? '',
      guestId: g.id,
      guestName: g.title ? `${g.title} ${g.name}` : g.name,
      // Masked only. The full number never reaches the browser on this route.
      phone: maskPhone(g.phone),
      status: parseContributionStatus(g.contribution?.status),
      amountPaid: g.contribution?.amountPaid ?? 0,
      amountExpected: g.contribution?.amountExpected ?? null,
      note: g.contribution?.note ?? null,
      updatedAt: g.contribution?.updatedAt ?? null,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { eventId } = await params;
  const event = await loadPublicEvent(eventId);
  // 404 rather than 403: a disabled tracker should be indistinguishable from
  // one that never existed, so the URL cannot be probed.
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(publicPayload(event));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, contributionsEnabled: true },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const guestId = body?.guestId ? String(body.guestId) : null;
  if (!body || !guestId) {
    return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
  }

  // Scoped to this event, so a guestId from another event cannot be written.
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true },
  });
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = await prisma.contribution.findUnique({
    where: { guestId },
    select: { id: true, status: true, amountPaid: true, amountExpected: true },
  });

  // Every guest on the event is now listed, so a guest without a row is a
  // legitimate target rather than a stranger: they were added to the event
  // after the last reminder went out. Writing a row for them is what makes the
  // list they can see actually editable. This stays a create-only-if-listed
  // operation on a guest already scoped to this event, and every write is
  // attributed below, so it cannot be used to touch anything else.
  const merged = reconcileContribution({
    // Absent fields keep whatever the tenant already recorded: a public editor
    // marking a guest "Paid" must not wipe the expected amount.
    status: ('status' in body
      ? parseContributionStatus(body.status)
      : (existing?.status ?? 'PENDING')) as never,
    amountPaid:
      'amountPaid' in body ? (body.amountPaid as number) : (existing?.amountPaid ?? 0),
    amountExpected:
      'amountExpected' in body
        ? ((body.amountExpected as number | null) ?? null)
        : (existing?.amountExpected ?? null),
  });

  const note =
    'note' in body ? (body.note ? String(body.note).slice(0, 500) : null) : undefined;

  // `remindedCount` is left alone: only the reminder send path may set it, and
  // it is deliberately 0 on a row created from the tracker.
  await prisma.contribution.upsert({
    where: { guestId },
    create: {
      eventId,
      guestId,
      status: merged.status,
      amountPaid: merged.amountPaid,
      amountExpected: merged.amountExpected,
      note: note ?? null,
      // Attribution matters here: this write path is unauthenticated, so the
      // tenant needs to be able to see who touched a row.
      updatedByName: 'Tracker (shared link)',
    },
    update: {
      status: merged.status,
      amountPaid: merged.amountPaid,
      amountExpected: merged.amountExpected,
      ...(note === undefined ? {} : { note }),
      updatedByName: 'Tracker (shared link)',
    },
  });

  const fresh = await loadPublicEvent(eventId);
  if (!fresh) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...publicPayload(fresh),
    updated: {
      guestId,
      status: merged.status,
      amountPaid: merged.amountPaid,
      amountPaidLabel: formatTZS(merged.amountPaid, fresh.contributionCurrency || 'TZS'),
    },
  });
}
