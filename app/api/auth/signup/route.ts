import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendNewSignupToAdmin } from '@/lib/email';
import { sendPushToRole } from '@/lib/push';

export async function POST(req: NextRequest) {
  const { business_name, subdomain, email, phone, password, name } = await req.json();

  if (!business_name || !subdomain || !email || !password || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const cleanSubdomain = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');

  const existingTenant = await prisma.tenant.findUnique({ where: { subdomain: cleanSubdomain } });
  if (existingTenant) {
    return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: business_name,
      subdomain: cleanSubdomain,
      subscriptionStatus: 'active',
      maxGuests: 200,
      credits: 0,
    },
  });

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      phone: phone || null, // was silently dropped before — never got saved
      role: 'CLIENT',
      tenantId: tenant.id,
      isActive: false,
      emailVerified: new Date(),
    },
  });

  // Notify super admin of the new signup awaiting approval
  sendNewSignupToAdmin({
    name,
    email,
    phone: phone || null,
    tenantName: business_name,
    subdomain: cleanSubdomain,
    method: 'email',
  }).catch((err) => console.error('Failed to send new signup email:', err));

  // Push to super admins' mobile devices
  sendPushToRole('SUPER_ADMIN', {
    title: 'New user signup',
    body: `${name} (${email}) from ${business_name} is awaiting approval.`,
    url: '/admin/users',
    type: 'alert',
    sound: true,
  }).catch(() => {});

  return NextResponse.json({ success: true, tenantId: tenant.id });
} 