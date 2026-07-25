import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { businessName, subdomain, userId } = await req.json();

    if (!businessName || !subdomain || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if subdomain is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (existingTenant) {
      return NextResponse.json(
        { error: 'Subdomain is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    // Create the Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: businessName,
        subdomain,
        plan: 'BASIC',
        status: 'ACTIVE',
        subscriptionStatus: 'inactive',
      },
    });

    // Update the User with tenantId and set role to CLIENT
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenant.id,
        role: 'CLIENT',
      },
    });

    return NextResponse.json({
      success: true,
      tenant,
      user,
    });
  } catch (error) {
    console.error('Complete signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}