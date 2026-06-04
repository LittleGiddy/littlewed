import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { tenantId: bodyTenantId } = await req.json(); // if you use body

  // Use the correct field name: subscriptionStatus (camelCase)
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: 'active' },
  });

  return NextResponse.json({ success: true });
}