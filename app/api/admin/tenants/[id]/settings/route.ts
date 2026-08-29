import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true, name: true, subdomain: true, plan: true, status: true,
        subscriptionStatus: true, credits: true, maxGuests: true,
        simpleEventMode: true, bypassPayment: true, testMode: true, creditsEnabled: true,
        templateCardUrl: true, thanksCardUrl: true, whatsappTemplate: true,
        whatsappAccount: true, adminEmail: true,
      },
    });

    if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const allowed = [
      'plan', 'maxGuests', 'credits', 'simpleEventMode', 'bypassPayment',
      'testMode', 'subscriptionStatus', 'whatsappTemplate', 'whatsappAccount',
      'adminEmail', 'creditsEnabled',
    ];
    const updateData: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, plan: true, subscriptionStatus: true, credits: true },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
