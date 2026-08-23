// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    console.log('[ForgotPassword] Request received:', { email });

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists and has a password
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, password: true },
    });

    // If user doesn't exist OR is Google-only (no password), don't send OTP
    // But still return success message (security)
    if (!user || !user.password) {
      console.log(`[ForgotPassword] ${!user ? 'Email not found' : 'Google-only account'}: ${email}`);
      return NextResponse.json({ 
        message: 'If an account exists with this email, we\'ve sent a password reset code.' 
      });
    }

    // Delete any previous OTP for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: email.toLowerCase().trim() },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.passwordResetToken.create({
      data: {
        email: email.toLowerCase().trim(),
        otp: otp,
        expiresAt: expiresAt,
      },
    });

    // Send email
    try {
      await resend.emails.send({
        from: 'LittleWed <noreply@littlewed.co.tz>',
        to: [email],
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #0D4F4F;">Password Reset Request</h2>
            <p>Use this OTP to reset your password:</p>
            <div style="background: #F0F4F8; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
            </div>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[ForgotPassword] Email send error:', emailError);
      // Still return success to avoid revealing email existence
    }

    return NextResponse.json({ 
      message: 'If an account exists with this email, we\'ve sent a password reset code.' 
    });

  } catch (error) {
    console.error('[ForgotPassword] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}