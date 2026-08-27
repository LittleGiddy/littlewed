import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          select: {
            id: true, name: true, date: true, venue: true, status: true,
            createdAt: true, guestCount: true,
            _count: { select: { guests: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          select: { id: true, amount: true, type: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { users: true, events: true, transactions: true, pendingEvents: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const totalGuests = tenant.events.reduce((acc, e) => acc + (e._count.guests || e.guestCount || 0), 0);
    const activeEvents = tenant.events.filter(e => e.status === 'ACTIVE' || e.status === 'LIVE').length;
    const staff = tenant.users.filter(u => u.role === 'STAFF');
    const clients = tenant.users.filter(u => u.role === 'CLIENT');
    const totalRevenue = tenant.transactions
      .filter(t => t.status === 'COMPLETED')
      .reduce((acc, t) => acc + t.amount, 0);

    return NextResponse.json({
      ...tenant,
      stats: {
        totalUsers: tenant._count.users,
        totalEvents: tenant._count.events,
        totalTransactions: tenant._count.transactions,
        totalPendingEvents: tenant._count.pendingEvents,
        totalGuests,
        activeEvents,
        staffCount: staff.length,
        clientCount: clients.length,
        totalRevenue,
      },
      events: tenant.events.map(e => ({
        ...e,
        guestCount: e._count.guests || e.guestCount || 0,
        _count: undefined,
      })),
      staff: staff.map(s => ({
        id: s.id, name: s.name, email: s.email, createdAt: s.createdAt,
      })),
      clients: clients.map(c => ({
        id: c.id, name: c.name, email: c.email, isActive: c.isActive, createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
