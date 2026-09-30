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
    include: {
      contributions: {
        include: { guest: { select: { id: true, name: true, title: true, phone: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      },
    },
  });
}

function publicPayload(event: NonNullable<Awaited<ReturnType<typeof loadPublicEvent>>>) {
  const summary = summariseContributions(event.contributions, {
    target: event.contributionTarget,
    currency: event.contributionCurrency,
  });

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
    rows: event.contributions.map((c) => ({
      id: c.id,
      guestId: c.guestId,
      guestName: c.guest.title ? `${c.guest.title} ${c.guest.name}` : c.guest.name,
      // Masked only. The full number never reaches the browser on this route.
      phone: maskPhone(c.guest.phone),
      status: parseContributionStatus(c.status),
      amountPaid: c.amountPaid,
      amountExpected: c.amountExpected,
      note: c.note,
      updatedAt: c.updatedAt,
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
  // Only guests who were actually reminded are listed, so an untracked guest
  // must not be creatable from the public page.
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = reconcileContribution({
    // Absent fields keep whatever the tenant already recorded: a public editor
    // marking a guest "Paid" must not wipe the expected amount.
    status: ('status' in body ? parseContributionStatus(body.status) : existing.status) as never,
    amountPaid:
      'amountPaid' in body
        ? (body.amountPaid as number)
        : (existing.amountPaid as number),
    amountExpected:
      'amountExpected' in body
        ? ((body.amountExpected as number | null) ?? null)
        : (existing.amountExpected as number | null),
  });

  const note =
    'note' in body ? (body.note ? String(body.note).slice(0, 500) : null) : undefined;

  await prisma.contribution.update({
    where: { id: existing.id },
    data: {
      status: merged.status,
      amountPaid: merged.amountPaid,
      amountExpected: merged.amountExpected,
      ...(note === undefined ? {} : { note }),
      // Attribution matters here: this write path is unauthenticated, so the
      // tenant needs to be able to see who touched a row.
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
