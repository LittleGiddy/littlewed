import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [recentUsers, recentEvents, recentGuests, recentTransactions] = await Promise.all([
      prisma.user.findMany({
        where: { role: { not: 'SUPER_ADMIN' } },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          createdAt: true, tenant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.event.findMany({
        select: {
          id: true, name: true, status: true, createdAt: true,
          tenant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.guest.findMany({
        select: {
          id: true, name: true, phone: true, createdAt: true,
          event: { select: { name: true, tenant: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.transaction.findMany({
        select: {
          id: true, amount: true, type: true, status: true, createdAt: true,
          tenant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const activities: any[] = [];

    recentUsers.forEach(u => {
      activities.push({
        id: `user-${u.id}`,
        type: 'user',
        description: u.isActive ? 'registered a new account' : 'registered (pending activation)',
        user: { name: u.name },
        tenant: u.tenant,
        createdAt: u.createdAt,
      });
    });

    recentEvents.forEach(e => {
      activities.push({
        id: `event-${e.id}`,
        type: 'event',
        description: `created event "${e.name}" (${e.status})`,
        user: { name: e.tenant?.name || 'Unknown' },
        tenant: e.tenant,
        createdAt: e.createdAt,
      });
    });

    recentGuests.forEach(g => {
      activities.push({
        id: `guest-${g.id}`,
        type: 'guest',
        description: `added guest "${g.name}" to "${g.event?.name || 'event'}"`,
        user: { name: g.event?.tenant?.name || 'Unknown' },
        tenant: g.event?.tenant,
        createdAt: g.createdAt,
      });
    });

    recentTransactions.forEach(t => {
      activities.push({
        id: `txn-${t.id}`,
        type: 'transaction',
        description: `${t.type.toLowerCase()} of ${t.amount} TZS (${t.status})`,
        user: { name: t.tenant?.name || 'Unknown' },
        tenant: t.tenant,
        createdAt: t.createdAt,
      });
    });

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(activities.slice(0, 30));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
