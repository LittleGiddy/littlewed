import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/staff/[id]/events
 * Every event in the tenant, annotated with `granted: true` for the ones this
 * staff member may access. Only the tenant owner (CLIENT/SUPER_ADMIN) may call.
 *
 * PUT /api/staff/[id]/events  { eventIds: string[] }
 * Replaces this staff member's event access with EXACTLY the given event ids -
 * any event not listed is revoked. The staff member only sees events with a
 * grant row, so a revoked event disappears from their portal immediately.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    const tenantId = (session.user as { tenantId?: string }).tenantId;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { id } = await params;
    const staff = await prisma.user.findFirst({ where: { id, tenantId, role: 'STAFF' } });
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const [events, grants] = await Promise.all([
      prisma.event.findMany({
        where: { tenantId },
        orderBy: { date: 'asc' },
        select: { id: true, name: true, date: true },
      }),
      prisma.eventStaffAccess.findMany({
        where: { userId: id },
        select: { eventId: true },
      }),
    ]);
    const granted = new Set(grants.map((g) => g.eventId));

    return NextResponse.json({
      events: events.map((e) => ({ ...e, granted: granted.has(e.id) })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load events';
    console.error('GET /api/staff/[id]/events error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    const tenantId = (session.user as { tenantId?: string }).tenantId;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { id } = await params;
    const staff = await prisma.user.findFirst({ where: { id, tenantId, role: 'STAFF' } });
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const eventIds: unknown = body?.eventIds;
    if (!Array.isArray(eventIds)) {
      return NextResponse.json({ error: 'eventIds must be an array' }, { status: 400 });
    }
    const ids = [...new Set(eventIds.filter((x): x is string => typeof x === 'string'))];

    const validCount = await prisma.event.count({
      where: { tenantId, id: { in: ids } },
    });
    if (validCount !== ids.length) {
      return NextResponse.json(
        { error: 'Some events do not belong to your account' },
        { status: 400 }
      );
    }

    // Replace the whole grant set - anything not listed is revoked.
    await prisma.$transaction([
      prisma.eventStaffAccess.deleteMany({ where: { userId: id } }),
      ...ids.map((eventId) =>
        prisma.eventStaffAccess.create({ data: { userId: id, eventId } })
      ),
    ]);

    return NextResponse.json({ success: true, eventIds: ids });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save access';
    console.error('PUT /api/staff/[id]/events error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}