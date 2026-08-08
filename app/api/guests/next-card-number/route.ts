import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  // Count all guests across all events for this tenant
  const count = await prisma.guest.count({
    where: { event: { tenantId } },
  });

  const cardNumber = `G-${String(count + 1).padStart(4, '0')}`;
  return NextResponse.json({ cardNumber });
}