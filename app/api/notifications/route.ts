import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notifications – fetch notifications for the current user
// Default (bell) returns unread. Pass ?all=1 to return everything recent
// first, with ?read=true|false to filter by read state.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = req.nextUrl;
  const all = searchParams.get('all') === '1';
  const readParam = searchParams.get('read');

  const where: any = { userId };
  if (!all) {
    where.isRead = false;
  } else if (readParam === 'true') {
    where.isRead = true;
  } else if (readParam === 'false') {
    where.isRead = false;
  }

  const take = Number(searchParams.get('take') || (all ? 200 : 20));
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Number.isFinite(take) ? Math.min(Math.max(take, 1), 500) : 200,
  });

  if (all) {
    const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
    return NextResponse.json({ notifications, unreadCount });
  }

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

// PATCH /api/notifications – mark notifications as read
// Body: { ids?: string[], all?: boolean }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const userId = (session.user as any).id;

  if (body?.all) {
    await prisma.notification.updateMany({ where: { userId }, data: { isRead: true } });
    return NextResponse.json({ success: true });
  }

  const ids = body?.ids;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId },
    data: { isRead: true },
  });
  return NextResponse.json({ success: true });
}

// DELETE /api/notifications – clear read notifications
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  await prisma.notification.deleteMany({ where: { userId, isRead: true } });
  return NextResponse.json({ success: true });
}