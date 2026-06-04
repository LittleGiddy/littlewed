import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { tenantId } = await req.json();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscription_status: 'active' },
  });
  return NextResponse.json({ success: true });
}