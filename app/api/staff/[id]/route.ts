import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;
  const staff = await prisma.user.findFirst({ where: { id, tenantId, role: 'STAFF' } });
  if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}