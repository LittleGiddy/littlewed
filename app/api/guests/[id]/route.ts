import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  const guest = await prisma.guest.findFirst({
    where: { id, event: { tenantId } },
  });
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  await prisma.guest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}