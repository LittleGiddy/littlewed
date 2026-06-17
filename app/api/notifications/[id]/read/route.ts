// app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any).id;

  const notification = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}