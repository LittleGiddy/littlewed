// app/api/events/[eventId]/edit-requests/route.ts
//
// The tenant's side of the guest detail change requests filed from the
// shared tracker: GET lists what is waiting, PATCH accepts or declines one.
// Accepting is the only place outside PUT /api/guests/[id] that writes a
// guest's name or phone, and it is tenant-scoped the same way.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessEvent } from '@/lib/eventAccess';

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

/** Pending proposals for this event, newest first. */
async function pendingList(
  eventId: string,
  auth: { id?: string; role: string; tenantId: string }
) {
  // Staff only see requests for events they were granted access to.
  const canAccess = await canAccessEvent({ user: auth }, eventId);
  if (!canAccess) return null;

  const rows = await prisma.guestEditRequest.findMany({
    where: { eventId, status: 'PENDING' },
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      guest: { select: { id: true, name: true, title: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    createdAt: r.createdAt.toISOString(),
    guestId: r.guest.id,
    guestName: r.guest.title ? `${r.guest.title} ${r.guest.name}` : r.guest.name,
    currentName: r.guest.name,
    currentPhone: r.guest.phone,
  }));
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

  const requests = await pendingList(eventId, auth);
  if (!requests) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ requests });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenantSession();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { eventId } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const requestId = body?.requestId ? String(body.requestId) : null;
  const action = body?.action === 'approve' ? 'approve' : body?.action === 'reject' ? 'reject' : null;
  if (!body || !requestId || !action) {
    return NextResponse.json({ error: 'requestId and action are required' }, { status: 400 });
  }

  // Tenant check first: an eventId outside this tenant 404s before the
  // request id is ever looked at, so foreign requests cannot be probed. Staff
  // additionally need a grant on this event.
  const canAccess = await canAccessEvent({ user: auth }, eventId);
  if (!canAccess) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const request = await prisma.guestEditRequest.findFirst({
    where: { id: requestId, eventId },
    select: {
      id: true,
      guestId: true,
      name: true,
      phone: true,
      status: true,
      guest: { select: { id: true } },
    },
  });
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  // Two planners may have the page open at once; the second tap should be
  // told the truth rather than silently overwriting the first decision.
  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 });
  }

  if (action === 'reject') {
    await prisma.guestEditRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', reviewedBy: auth.userName ?? 'Planner', reviewedAt: new Date() },
    });
    const requests = await pendingList(eventId, auth);
    return NextResponse.json({ ok: true, action: 'REJECTED', requests });
  }

  // ─── Approve ────────────────────────────────────────────────────────
  const guest = await prisma.guest.findFirst({
    where: { id: request.guestId, eventId },
    select: { id: true, name: true, phone: true },
  });
  if (!guest) {
    // The guest was deleted while the proposal waited. Settle the request so
    // it stops appearing in the queue instead of leaving it pending forever.
    await prisma.guestEditRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', reviewedBy: auth.userName ?? 'Planner', reviewedAt: new Date() },
    });
    const remaining = await pendingList(eventId, auth);
    return NextResponse.json(
      { ok: true, action: 'REJECTED', requests: remaining, error: 'That guest no longer exists' },
      { status: 409 }
    );
  }

  // The number may have been taken by another guest since the proposal was
  // filed, which the tracker's submission check could not have known about.
  if (request.phone) {
    const duplicate = await prisma.guest.findFirst({
      where: { eventId, phone: request.phone, id: { not: guest.id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Another guest on this event already uses that phone number' },
        { status: 409 }
      );
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.guest.update({
      where: { id: guest.id },
      data: { name: request.name, phone: request.phone },
      select: { id: true, name: true, phone: true },
    }),
    prisma.guestEditRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', reviewedBy: auth.userName ?? 'Planner', reviewedAt: new Date() },
    }),
  ]);

  const requests = await pendingList(eventId, auth);
  return NextResponse.json({
    ok: true,
    action: 'APPROVED',
    requests,
    updated: { guestId: updated.id, name: updated.name, phone: updated.phone },
  });
}
