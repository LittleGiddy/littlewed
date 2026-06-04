import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET – fetch tenant settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        templateCardUrl: true,
        qrPlacementX: true,
        qrPlacementY: true,
        qrSize: true,
        simpleEventMode: true,
      },
    });

    // Return with camelCase keys that frontend expects
    return NextResponse.json({
      templateCardUrl: tenant?.templateCardUrl ?? null,
      qrPlacementX: tenant?.qrPlacementX ?? 50,
      qrPlacementY: tenant?.qrPlacementY ?? 50,
      qrSize: tenant?.qrSize ?? 150,
      simpleEventMode: tenant?.simpleEventMode ?? false,
    });
  } catch (error) {
    console.error('GET /api/tenant/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT – update tenant settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { templateCardUrl, qrPlacementX, qrPlacementY, qrSize, simpleEventMode } = await req.json();

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        templateCardUrl,
        qrPlacementX,
        qrPlacementY,
        qrSize,
        simpleEventMode,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/tenant/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}