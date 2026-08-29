// app/api/admin/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendBroadcastEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';

const APP_URL = 'https://littlewed.co.tz';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { subject?: string; message?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const subject = (body.subject || '').trim();
  const message = (body.message || '').trim();
  const audience = body.audience || 'all';

  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }
  if (!['all', 'clients', 'staff'].includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
  }

  const roleFilter: Prisma.UserWhereInput =
    audience === 'clients' ? { role: 'CLIENT' }
    : audience === 'staff' ? { role: 'STAFF' }
    : { role: { in: ['CLIENT', 'STAFF'] } };

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...roleFilter,
    },
    select: { id: true, email: true, name: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ success: true, userCount: 0, emailed: 0 }, { status: 200 });
  }

  // ─── In-app notifications ─────────────────────────────────────────────
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'info',
      title: subject,
      message,
      link: '/client/dashboard',
      isRead: false,
    })),
  });

  // ─── Web push (fire & forget) ─────────────────────────────────────────
  for (const u of users) {
    sendPushToUser(u.id, {
      title: subject,
      body: message,
      url: '/client/dashboard',
      type: 'info',
      sound: true,
    }).catch(() => {});
  }

  // ─── Email broadcast from admin@littlewed.co.tz ──────────────────────
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #0D4B4B; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; font-size: 24px; margin: 0;">LittleWed</h1>
      </div>
      <div style="background: #f8fafb; padding: 32px; border: 1px solid #e8ecef; border-top: none;">
        <h2 style="color: #1a2b3c; font-size: 20px; margin: 0 0 12px;">${subject}</h2>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 20px; white-space: pre-line;">${message.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${APP_URL}/client/dashboard" style="display: inline-block; background: #0D4B4B; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">Go to Dashboard →</a>
        </div>
      </div>
      <div style="padding: 16px 32px; text-align: center;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">LittleWed - Wedding Management Platform</p>
      </div>
    </div>
  `;

  const toAddresses = users.map((u) => u.email).filter((e): e is string => !!e);
  const emailResults = toAddresses.length > 0
    ? await sendBroadcastEmail(toAddresses, subject, htmlBody)
    : {};
  const emailed = Object.values(emailResults).filter(Boolean).length;

  return NextResponse.json({
    success: true,
    userCount: users.length,
    emailed,
    failedEmails: toAddresses.length - emailed,
  });
}
