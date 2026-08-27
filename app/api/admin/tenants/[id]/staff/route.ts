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
    const staff = await prisma.user.findMany({
      where: { tenantId: id, role: 'STAFF' },
      orderBy: { createdAt: 'desc' },
      include: {
        notifications: {
          select: { id: true, title: true, isRead: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json(staff.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      createdAt: s.createdAt,
      recentNotifications: s.notifications,
      notificationCount: s.notifications.length,
      unreadCount: s.notifications.filter(n => !n.isRead).length,
    })));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
