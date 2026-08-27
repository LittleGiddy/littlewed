import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCreditRequestSubmittedEmail, sendCreditRequestToAdmin } from '@/lib/email';

const CREDIT_COST_TZS = 500;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const userId = (session.user as any).id;
  const { credits, reason } = await req.json();

  if (!credits || credits < 1) {
    return NextResponse.json({ error: 'Must request at least 1 credit' }, { status: 400 });
  }

  const existingPending = await prisma.creditRequest.findFirst({
    where: { tenantId, status: 'PENDING' },
  });

  if (existingPending) {
    return NextResponse.json(
      { error: 'You already have a pending credit request. Wait for it to be reviewed.' },
      { status: 400 }
    );
  }

  const request = await prisma.creditRequest.create({
    data: {
      tenantId,
      userId,
      requestedCredits: credits,
      amountTZS: credits * CREDIT_COST_TZS,
      reason: reason || null,
      status: 'PENDING',
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: 'CREDIT_REQUEST',
      title: 'Credit Request Submitted',
      message: `Your request for ${credits} credits (${(credits * CREDIT_COST_TZS).toLocaleString()} TZS) has been sent to the admin. Contact +255702529514 for assistance.`,
      isRead: false,
    },
  });

  // Send email to user confirming request
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (user?.email) {
    sendCreditRequestSubmittedEmail(
      user.email,
      user.name || 'there',
      credits,
      credits * CREDIT_COST_TZS
    ).catch((err) => console.error('Failed to send credit request email:', err));
  }

  // Send email to admin if adminEmail is set on tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { adminEmail: true, name: true },
  });
  if (tenant?.adminEmail) {
    sendCreditRequestToAdmin(
      tenant.adminEmail,
      user?.name || 'Unknown',
      tenant.name,
      credits,
      credits * CREDIT_COST_TZS,
      reason || null
    ).catch((err) => console.error('Failed to send admin notification email:', err));
  }

  // Notify all super admins
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (superAdmins.length > 0) {
    await prisma.notification.createMany({
      data: superAdmins.map((admin) => ({
        userId: admin.id,
        type: 'CREDIT_REQUEST',
        title: 'New Credit Request',
        message: `${user?.name || 'Unknown'} from ${tenant?.name || 'Unknown'} requested ${credits} credits (${(credits * CREDIT_COST_TZS).toLocaleString()} TZS).`,
        isRead: false,
      })),
    });
  }

  return NextResponse.json({
    success: true,
    request: {
      id: request.id,
      requestedCredits: request.requestedCredits,
      amountTZS: request.amountTZS,
      status: request.status,
      createdAt: request.createdAt,
    },
  });
}
