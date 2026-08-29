// app/api/auth/send-verification/route.ts
// Fixed: don't block emails that exist only as Google-only accounts (no password).

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // Block only if email exists WITH a password (credentials account).
  // A Google-only account (password: '') should not block a new password signup
  // - but in practice we shouldn't allow that either. Block all existing emails.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });

  if (existingUser) {
    if (existingUser.password) {
      // Full credentials account
      return NextResponse.json(
        { error: 'Email already registered. Please log in instead.' },
        { status: 409 }
      );
    } else {
      // Google-only account - block duplicate signup via email too
      return NextResponse.json(
        { error: 'This email is linked to a Google account. Please sign in with Google.' },
        { status: 409 }
      );
    }
  }

  // Delete any previous OTP for this email
  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { email, otp, expiresAt },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 OTP for', email, ':', otp);
    return NextResponse.json({ message: 'OTP logged to console (dev mode)', dev_otp: otp });
  }

  try {
    const { error } = await resend.emails.send({
      from: 'LittleWed <noreply@littlewed.co.tz>',
      to: [email],
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #0D4B4B;">Welcome to LittleWed</h2>
          <p>Use this OTP to verify your email:</p>
          <div style="background: #F0F4F8; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
          </div>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Resend request error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}