// app/api/register/complete-google/route.ts
// Called by /signup/complete after Google OAuth.
// Creates the Tenant and links it to the already-created User.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { business_name, subdomain } = await req.json();

  if (!business_name?.trim() || !subdomain?.trim()) {
    return NextResponse.json({ error: 'Business name and subdomain are required' }, { status: 400 });
  }

  const email = session.user.email;

  // Find the user created by auth.ts signIn callback
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Already has a tenant — idempotent, just redirect
  if (user.tenantId) {
    return NextResponse.json({ message: 'Workspace already exists' });
  }

  // Check subdomain availability
  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    return NextResponse.json({ error: 'Subdomain already taken. Please choose another.' }, { status: 409 });
  }

  // Create tenant and link user — atomic
  const tenant = await prisma.tenant.create({
    data: {
      name: business_name,
      subdomain,
      credits: 0,
      simpleEventMode: false,
    },
  });

  await prisma.user.update({
    where: { email },
    data: { tenantId: tenant.id },
  });

  return NextResponse.json({ message: 'Workspace created successfully' });
}