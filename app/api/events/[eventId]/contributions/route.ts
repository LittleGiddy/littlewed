// app/api/events/[eventId]/contributions/route.ts
// Tenant-authed read/update for contribution tracking.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
  return { tenantId, userName: (session.user as { name?: string }).name || null } as const;
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

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId: auth.tenantId },
    include: {
      contributions: {
        include: {
          guest: {
            select: { id: true, name: true, title: true, phone: true, reminderCount: true },
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      },
    },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const summary = summariseContributions(event.contributions, {
    target: event.contributionTarget,
    currency: event.contributionCurrency,
  });

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      venue: event.venue,
      address: event.address,
      person1: event.person1,
      person2: event.person2,
      hostFamily: event.hostFamily,
      contributionsEnabled: event.contributionsEnabled,
      eventType: event.eventType,
      contributionDeadline: event.contributionDeadline,
      contributionTarget: event.contributionTarget,
      contributionCurrency: event.contributionCurrency,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
    },
    summary,
    rows: event.contributions.map((c) => ({
      id: c.id,
      guestId: c.guestId,
      guestName: c.guest.title ? `${c.guest.title} ${c.guest.name}` : c.guest.name,
      // Tenant view shows the full number: they need it to send reminders and
      // to reconcile against a bank statement.
      phone: c.guest.phone,
      phoneMasked: maskPhone(c.guest.phone),
      status: parseContributionStatus(c.status),
      amountPaid: c.amountPaid,
      amountExpected: c.amountExpected,
      note: c.note,
      updatedByName: c.updatedByName,
      remindedAt: c.remindedAt,
      remindedCount: c.remindedCount,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

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

  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId: auth.tenantId },
    include: {
      contributions: {
        include: { guest: { select: { id: true, name: true, title: true, phone: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      },
    },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json({
    event: {
      id: event.id,
      contributionsEnabled: event.contributionsEnabled,
      eventType: event.eventType,
      contributionDeadline: event.contributionDeadline,
      contributionTarget: event.contributionTarget,
      contributionCurrency: event.contributionCurrency,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
    },
    summary: summariseContributions(event.contributions, {
      target: event.contributionTarget,
      currency: event.contributionCurrency,
    }),
    rows: event.contributions.map((c) => ({
      id: c.id,
      guestId: c.guestId,
      guestName: c.guest.title ? `${c.guest.title} ${c.guest.name}` : c.guest.name,
      phone: c.guest.phone,
      phoneMasked: maskPhone(c.guest.phone),
      status: parseContributionStatus(c.status),
      amountPaid: c.amountPaid,
      amountExpected: c.amountExpected,
      note: c.note,
      updatedByName: c.updatedByName,
      remindedAt: c.remindedAt,
      remindedCount: c.remindedCount,
      updatedAt: c.updatedAt,
    })),
  });
}
