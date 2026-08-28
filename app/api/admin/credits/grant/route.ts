import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCreditGrantedEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminUserId = (session.user as any).id;
  const { requestId, action, grantedCredits } = await req.json();

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const request = await prisma.creditRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 });
  }

  if (action === 'approve') {
    const credits = grantedCredits || request.requestedCredits;

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: request.tenantId },
        data: { credits: { increment: credits } },
      });

      await tx.creditRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          grantedCredits: credits,
        },
      });

      await tx.transaction.create({
        data: {
          amount: credits * 500,
          type: 'CREDIT_PURCHASE',
          status: 'COMPLETED',
          tenantId: request.tenantId,
          userId: request.userId,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          type: 'CREDIT_GRANTED',
          title: 'Credits Granted',
          message: `Your request for ${credits} credits has been approved! ${credits} credits have been added to your account.`,
          isRead: false,
        },
      });
    });

    // Send email to user that credits were granted
    const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { email: true, name: true } });
    if (user?.email) {
      sendCreditGrantedEmail(
        user.email,
        user.name || 'there',
        credits,
        credits * 500
      ).catch((err) => console.error('Failed to send credit granted email:', err));
    }

    // Push notification to requester
    sendPushToUser(request.userId, {
      title: 'Credits Granted',
      body: `Your request for ${credits} credits has been approved and added to your account.`,
      url: '/client/settings',
      type: 'success',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({ success: true, credits });
  }

  if (action === 'reject') {
    await prisma.creditRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        grantedCredits: 0,
      },
    });

    await prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'CREDIT_REJECTED',
        title: 'Credit Request Declined',
        message: 'Your credit request has been declined by the admin.',
        isRead: false,
      },
    });

    // Push notification to requester
    sendPushToUser(request.userId, {
      title: 'Credit Request Declined',
      body: 'Your credit request has been declined by the admin.',
      url: '/client/settings',
      type: 'error',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
