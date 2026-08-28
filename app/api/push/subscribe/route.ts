import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));

  const { endpoint, keys } = body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        keysP256dh: keys.p256dh,
        keysAuth: keys.auth,
        userAgent: req.headers.get('user-agent') || undefined,
      },
      update: {
        userId,
        keysP256dh: keys.p256dh,
        keysAuth: keys.auth,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
