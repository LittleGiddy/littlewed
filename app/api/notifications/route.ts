import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notifications – fetch unread notifications for the current user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const notifications = await prisma.notification.findMany({
    where: { userId, isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json(notifications);
}

// POST /api/notifications – create a notification (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, title, message, type, link } = await req.json();
  if (!userId || !title) {
    return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type: type || 'info',
      link: link || null,
    },
  });

  return NextResponse.json(notification);
}