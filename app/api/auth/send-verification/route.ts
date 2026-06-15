import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // ✅ Check if email already registered
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }, // only check existence
  });

  if (existingUser) {
    return NextResponse.json(
      { error: 'Email already registered. Please log in instead.' },
      { status: 409 } // Conflict
    );
  }

  // Delete any previous OTP for this email (cleanup)
  await prisma.verificationToken.deleteMany({ where: { email } });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.verificationToken.create({
    data: { email, otp, expiresAt },
  });

  try {
    await resend.emails.send({
      from: 'LittleWed <onboarding@resend.dev>', // replace with your verified domain when ready
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
    return NextResponse.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}