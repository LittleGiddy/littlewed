import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const where: any = {};
  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    where.status = status;
  }

  const requests = await prisma.creditRequest.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true, subdomain: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const summary = await prisma.creditRequest.groupBy({
    by: ['status'],
    _count: { id: true },
    _sum: { requestedCredits: true },
  });

  return NextResponse.json({ requests, summary });
}
