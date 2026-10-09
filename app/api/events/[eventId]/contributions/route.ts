// app/api/events/[eventId]/contributions/route.ts
// Tenant-authed read/update for contribution tracking.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { canAccessEvent } from '@/lib/eventAccess';
import {
  parseContributionStatus,
  reconcileContribution,
  summariseContributions,
  maskPhone,
  type ContributionStatus,
} from '@/lib/contributions';

type Ctx = { params: Promise<{ eventId: string }> };

async function requireTenantSession() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: 'Unauthorized', status: 401 } as const;
  const role = (session.user as { role?: string }).role;
  if (role !== 'CLIENT' && role !== 'STAFF') {
    return { error: 'Forbidden', status: 403 } as const;
  }
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) return { error: 'No tenant', status: 403 } as const;
  return {
    tenantId,
    id: (session.user as { id?: string }).id,
    role,
    userName: (session.user as { name?: string }).name || null,
  } as const;
}

/** Fields the tenant is allowed to change on the event itself. */
const EVENT_FIELDS = [
  'contributionsEnabled',
  'eventType',
  'contributionDeadline',
  'contributionTarget',
  'contributionCurrency',
  'mpesaInstructions',
  'airtelInstructions',
  'bankInstructions',
] as const;

/**
 * The tenant's full contribution view.
 *
 * Built from the guest list rather than from the Contribution rows, because a
 * row only exists once someone has been reminded. Reading rows alone hid every
 * guest who has not been reminded yet, which made "All" show an incomplete
 * list and left the tenant unable to record a contribution for a guest before
 * sending the first reminder.
 *
 * `hasContribution` distinguishes a real tracked row from a guest who is
 * simply included by virtue of being on the list.
 */
async function tenantPayload(
  eventId: string,
  auth: { id?: string; role: string; tenantId: string }
) {
  // Staff only reach events they were explicitly granted access to.
  const canAccess = await canAccessEvent({ user: auth }, eventId);
  if (!canAccess) return null;

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      date: true,
      venue: true,
      address: true,
      person1: true,
      person2: true,
      hostFamily: true,
      contributionsEnabled: true,
      eventType: true,
      contributionDeadline: true,
      contributionTarget: true,
      contributionCurrency: true,
      mpesaInstructions: true,
      airtelInstructions: true,
      bankInstructions: true,
    },
  });
  if (!event) return null;

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      title: true,
      phone: true,
      reminderCount: true,
      contribution: {
        select: {
          id: true,
          status: true,
          amountPaid: true,
          amountExpected: true,
          note: true,
          updatedByName: true,
          remindedAt: true,
          remindedCount: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rows = guests.map((g) => {
    const c = g.contribution;
    return {
      id: c?.id ?? '',
      guestId: g.id,
      guestName: g.title ? `${g.title} ${g.name}` : g.name,
      // Raw values for the edit form: guestName carries the title, so saving
      // that back would grow "Mr" into "Mr Mr" after one round trip.
      name: g.name,
      title: g.title,
      // Tenant view shows the full number: they need it to send reminders and
      // to reconcile against a bank statement.
      phone: g.phone,
      phoneMasked: maskPhone(g.phone),
      status: parseContributionStatus(c?.status),
      amountPaid: c?.amountPaid ?? 0,
      amountExpected: c?.amountExpected ?? null,
      note: c?.note ?? null,
      updatedByName: c?.updatedByName ?? null,
      // The guest's own counter is the live one; the contribution row's copy is
      // only written when a reminder actually sends.
      remindedCount: g.reminderCount,
      remindedAt: c?.remindedAt ?? null,
      updatedAt: c?.updatedAt ?? null,
      /** False for a guest who has never been reminded and so has no row yet. */
      hasContribution: !!c,
    };
  });

  // Sort so the money that needs attention surfaces first: anyone not settled,
  // then by how much is still outstanding, then alphabetically.
  const rank: Record<ContributionStatus, number> = { PARTIAL: 0, PENDING: 1, PAID: 2 };
  rows.sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    const byGuest = a.guestName.localeCompare(b.guestName);
    if (byGuest !== 0) return byGuest;
    return (b.amountPaid ?? 0) - (a.amountPaid ?? 0);
  });

  const summary = summariseContributions(
    rows.map((r) => ({ status: r.status, amountPaid: r.amountPaid, amountExpected: r.amountExpected })),
    { target: event.contributionTarget, currency: event.contributionCurrency }
  );

  return { event, summary, rows };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

  const payload = await tenantPayload(eventId, auth);
  if (!payload) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json(payload);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

  // Authorisation for the whole PATCH: staff need a grant on this event, and
  // the event-level + per-guest writes below all happen against that scope.
  const canAccess = await canAccessEvent({ user: auth }, eventId);
  if (!canAccess) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // ─── Event-level settings ───────────────────────────────────────────
  if (body.settings && typeof body.settings === 'object') {
    const settings = body.settings as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const key of EVENT_FIELDS) {
      if (!(key in settings)) continue;
      const value = settings[key];
      switch (key) {
        case 'contributionsEnabled':
          data[key] = Boolean(value);
          break;
        case 'contributionTarget':
          data[key] =
            value === null || value === '' || typeof value === 'undefined'
              ? null
              : Math.max(0, Math.round(Number(value) || 0));
          break;
        case 'contributionDeadline':
          data[key] = value ? new Date(String(value)) : null;
          break;
        case 'contributionCurrency':
          data[key] = value ? String(value).slice(0, 8) : 'TZS';
          break;
        default:
          data[key] = value === null || value === '' ? null : String(value);
      }
    }
    if (Object.keys(data).length > 0) {
      // tenantId in the where clause is the authorisation check.
      const updated = await prisma.event.updateMany({
        where: { id: eventId, tenantId: auth.tenantId },
        data,
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
    }
  }

  // ─── Per-guest contribution row ─────────────────────────────────────
  if (body.guestId) {
    const guest = await prisma.guest.findFirst({
      where: { id: String(body.guestId), eventId },
      select: { id: true, event: { select: { tenantId: true } } },
    });
    if (!guest || guest.event.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ─── Guest details (name / phone) ──────────────────────────────
    // Written straight to the Guest row the tenant's guest list reads, so an
    // edit here is the same edit the guest list would make - there is no copy
    // of these fields on the Contribution row to keep in sync.
    if (body.guest !== undefined && body.guest !== null) {
      if (typeof body.guest !== 'object') {
        return NextResponse.json({ error: 'Invalid guest details' }, { status: 400 });
      }
      const details = body.guest as Record<string, unknown>;
      const data: { name?: string; phone?: string | null } = {};

      if ('name' in details) {
        const name = String(details.name ?? '').trim();
        if (!name) {
          return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        data.name = name;
      }

      if ('phone' in details) {
        // An empty number clears it: plenty of imported guests have no line
        // yet, and blocking the save would trap the tenant on a stale value.
        const raw = String(details.phone ?? '').trim();
        if (!raw) {
          data.phone = null;
        } else {
          const { normalized, isValid } = normalizePhone(raw);
          if (!isValid) {
            return NextResponse.json(
              {
                error:
                  'Invalid phone number format. Must start with "+" and include country code (e.g., +255712345678).',
              },
              { status: 400 }
            );
          }
          const duplicate = await prisma.guest.findFirst({
            where: { eventId, phone: normalized, id: { not: guest.id } },
            select: { id: true },
          });
          if (duplicate) {
            return NextResponse.json(
              { error: 'A guest with this phone number already exists in this event' },
              { status: 409 }
            );
          }
          data.phone = normalized;
        }
      }

      if (Object.keys(data).length > 0) {
        await prisma.guest.update({ where: { id: guest.id }, data });
      }
    }

    const existing = await prisma.contribution.findUnique({
      where: { guestId: guest.id },
      select: { status: true, amountPaid: true, amountExpected: true },
    });

    // Absent fields keep what is already recorded. reconcileContribution treats
    // a missing amount as 0, so without this merge a status-only tap (the three
    // status buttons) would silently wipe the money already received.
    const merged = reconcileContribution({
      status:
        body.status !== undefined
          ? (parseContributionStatus(body.status) as ContributionStatus)
          : (existing?.status as ContributionStatus | undefined),
      amountPaid:
        body.amountPaid !== undefined ? (body.amountPaid as number) : (existing?.amountPaid ?? 0),
      amountExpected:
        body.amountExpected !== undefined
          ? ((body.amountExpected as number | null) ?? null)
          : (existing?.amountExpected ?? null),
    });

    const note =
      body.note !== undefined
        ? body.note
          ? String(body.note).slice(0, 500)
          : null
        : undefined;

    await prisma.contribution.upsert({
      where: { guestId: guest.id },
      create: {
        eventId,
        guestId: guest.id,
        status: merged.status,
        amountPaid: merged.amountPaid,
        amountExpected: merged.amountExpected,
        note: note ?? null,
        updatedByName: auth.userName ?? 'Tenant',
      },
      update: {
        status: merged.status,
        amountPaid: merged.amountPaid,
        amountExpected: merged.amountExpected,
        note,
        updatedByName: auth.userName ?? 'Tenant',
      },
    });
  }

  // Rebuilt through the same helper as GET, so a settings save can never return
  // a narrower event object than a plain read. The client keeps this payload
  // as its state, and a partial event was blanking the page title.
  const payload = await tenantPayload(eventId, auth);
  if (!payload) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json(payload);
}
