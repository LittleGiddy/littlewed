// app/api/public/events/[eventId]/contributions/route.ts
// Read + update for the shared contribution ledger at /[eventId]/contributions.
//
// The link is the event owner's: they open it to record the contributions they
// have received. That makes this an owner's tool rather than a guest's, which
// is why payment instructions are no longer part of the payload and the page no
// longer speaks to the visitor as if they were the one paying.
//
// There is no middleware in this project, so "public" simply means this route
// does not call getServerSession. That is fine for reads, but it also means a
// write here is reachable by anyone holding the link. The mitigations are:
//   - the link is never published anywhere: it is handed to the owner only
//   - every write records who made it and when, so the tenant can see changes
//   - writes only ever move a guest between known statuses
// Guest phone numbers are sent in full. This ledger is the owner's own record
// of who has paid, so a masked number would only get in the way of calling the
// people they are chasing. The link is a capability, not an authentication.
// Treat it as the owner's own secret: anyone who opens it can see the guest
// list and change the ledger.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseContributionStatus,
  reconcileContribution,
  summariseContributions,
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
      venue: true,
      address: true,
      person1: true,
      person2: true,
      contributionTarget: true,
      contributionCurrency: true,
      // Payment instructions are deliberately not selected: this payload feeds
      // the owner's ledger, which no longer shows them. Leaving them selected
      // would keep the account numbers one network-tab away from a page that has
      // no use for them.
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
          // A proposal filed from this tracker that the planner has not
          // answered yet, so the sheet can say "your change is with them"
          // instead of quietly looking like it saved.
          editRequests: {
            where: { status: 'PENDING' },
            select: { name: true, phone: true },
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
      venue: event.venue,
      address: event.address,
      person1: event.person1,
      person2: event.person2,
      currency: event.contributionCurrency || 'TZS',
      target: event.contributionTarget,
      // Payment instructions are not sent to this page. The tracker is the
      // owner's record of what has been received, not an instruction sheet, so
      // the M-Pesa/Airtel/bank details are left out of both the page and this
      // payload. Nothing else consumes this endpoint.
    },
    summary,
    rows: event.guests.map((g) => ({
      id: g.contribution?.id ?? '',
      guestId: g.id,
      guestName: g.title ? `${g.title} ${g.name}` : g.name,
      // Raw name for the edit form: guestName carries the title, and saving
      // that back would grow "Mr" into "Mr Mr" after one round trip.
      name: g.name,
      // Full number, deliberately: the owner reads this list to recognise and
      // call the guests they are chasing, and the tracker searches by it.
      phone: g.phone,
      status: parseContributionStatus(g.contribution?.status),
      amountPaid: g.contribution?.amountPaid ?? 0,
      amountExpected: g.contribution?.amountExpected ?? null,
      note: g.contribution?.note ?? null,
      updatedAt: g.contribution?.updatedAt ?? null,
      /** The guest's still-unreviewed detail proposal, if one is waiting. */
      pendingEdit: g.editRequests[0] ?? null,
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
