// app/api/auth/complete-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendNewSignupToAdmin } from '@/lib/email';
import { sendPushToRole } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('[CompleteSignup] Session:', session?.user?.email);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessName, subdomain } = await req.json();

    if (!businessName || !subdomain) {
      return NextResponse.json(
        { error: 'Business name and subdomain are required' },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // Check if user already has a tenant
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, isActive: true },
    });

    console.log('[CompleteSignup] Existing user:', {
      userId,
      hasTenant: !!existingUser?.tenantId,
      isActive: existingUser?.isActive,
    });

    if (existingUser?.tenantId) {
      return NextResponse.json(
        { error: 'You already have an organization' },
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
        subscriptionStatus: 'active',
        maxGuests: 200,
        credits: 0,
        simpleEventMode: false,
        bypassPayment: false,
        testMode: false,
      },
    });

    console.log('[CompleteSignup] Tenant created:', tenant.id);

    // Update the User with tenantId and activate them
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenant.id,
        role: 'CLIENT',
        
      },
    });

    console.log('[CompleteSignup] User updated:', user.id);

    // Notify super admin of the new signup awaiting approval
    sendNewSignupToAdmin({
      name: user.name || '',
      email: user.email,
      phone: undefined,
      tenantName: tenant.name,
      subdomain: tenant.subdomain,
      method: 'google',
    }).catch((err) => console.error('Failed to send new signup email:', err));

    // Push to super admins' mobile devices
    sendPushToRole('SUPER_ADMIN', {
      title: 'New user signup',
      body: `${user.name || ''} (${user.email}) from ${tenant.name} is awaiting approval.`,
      url: '/admin/users',
      type: 'alert',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('[CompleteSignup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}