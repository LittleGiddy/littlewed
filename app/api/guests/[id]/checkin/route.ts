import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== 'CLIENT' && role !== 'STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { checkedIn } = await req.json();

  const guest = await prisma.guest.findFirst({
    where: { id, event: { tenantId: (session.user as any).tenantId } },
  });
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.guest.update({
    where: { id },
    data: { checkedIn, checkedInAt: checkedIn ? new Date() : null },
  });

  return NextResponse.json(updated);
}