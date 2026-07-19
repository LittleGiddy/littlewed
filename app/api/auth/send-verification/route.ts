import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // Check if email already registered
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: 'Email already registered. Please log in instead.' },
      { status: 409 }
    );
  }

  // Delete any previous OTP for this email
  await prisma.verificationToken.deleteMany({ where: { email } });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { email, otp, expiresAt },
  });

  // ─── In development, log the OTP to console ──────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 OTP for', email, ':', otp);
    // Still try to send via Resend, but if it fails we can continue
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'LittleWed <noreply@littlewed.co.tz>',
      to: [email],
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #0D4F4F;">Welcome to LittleWed</h2>
          <p>Use this OTP to verify your email:</p>
          <div style="background: #F0F4F8; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't sign up, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error details:', error);
      // In development, still return success (the OTP is logged)
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          message: 'OTP logged to console (dev mode)',
          dev_otp: otp,
        });
      }
      return NextResponse.json(
        { error: error.message || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend request error:', error);
    // In development, return success with the OTP
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        message: 'OTP logged to console (dev mode)',
        dev_otp: otp,
      });
    }
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}