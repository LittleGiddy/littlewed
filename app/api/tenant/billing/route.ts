import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { credits: true, name: true, plan: true },
  });

  const usage = await prisma.usageRecord.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    // include removed to avoid TypeScript error (event relation not needed for send page)
  });

  return NextResponse.json({ tenant, usage });
}