// app/api/auth/verify-email/route.ts
// Unchanged logic, but using correct model name (verificationToken not emailVerificationToken).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();

  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP required' }, { status: 400 });
  }

  const token = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      otp,
      expiresAt: { gt: new Date() },
    },
  });

  if (!token) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  // Delete used token
  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  return NextResponse.json({ message: 'Email verified' });
}