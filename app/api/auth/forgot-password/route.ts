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

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, password: true },
    });

    // ─── Case 1: User doesn't exist ──────────────────────────────────────────
    if (!user) {
      console.log(`[ForgotPassword] Email not found: ${email}`);
      // Security: Always return the same message
      return NextResponse.json({ 
        message: 'If an account exists, we\'ve sent a verification code.' 
      });
    }

    // ─── Case 2: Google-only account (no password) ──────────────────────────
    if (!user.password) {
      console.log(`[ForgotPassword] Google-only account setting password: ${email}`);
      // ✅ Allow Google users to set a password
      // Send OTP to verify email ownership
    }

    // ─── Delete any previous OTP for this email ─────────────────────────────
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

    // ─── Send email ───────────────────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 OTP for', email, ':', otp);
    }

    try {
      // Determine email subject and message based on user type
      const isGoogleUser = user && !user.password;
      const subject = isGoogleUser 
        ? 'Set a password for your Google account' 
        : 'Reset your password';
      
      const introText = isGoogleUser
        ? 'You requested to set a password for your Google account. This will allow you to sign in with either method.'
        : 'We received a request to reset your password.';

      const { error } = await resend.emails.send({
        from: 'LittleWed <noreply@littlewed.co.tz>',
        to: [email],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #0D4F4F; font-size: 24px; margin: 0;">LittleWed</h1>
            </div>
            <div style="background: #F5F8FA; border-radius: 12px; padding: 30px; border: 1px solid #E8EEF2;">
              <h2 style="color: #0D1B1B; font-size: 20px; margin-top: 0;">${isGoogleUser ? 'Set Your Password' : 'Reset Your Password'}</h2>
              <p style="color: #4A6072; font-size: 15px; line-height: 1.6;">
                ${introText}
              </p>
              ${isGoogleUser ? `
                <div style="background: #E8F5E9; padding: 12px; border-radius: 8px; margin: 16px 0;">
                  <p style="color: #2E7D32; font-size: 13px; margin: 0;">
                    ✅ After setting a password, you can sign in with either Google or email/password.
                  </p>
                </div>
              ` : ''}
              <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px solid #E2EAF0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #0D4F4F;">${otp}</span>
              </div>
              <p style="color: #7A8FA6; font-size: 13px; margin-bottom: 0;">
                This code will expire in <strong>10 minutes</strong>.
              </p>
            </div>
            <p style="color: #B0BEC8; font-size: 12px; text-align: center; margin-top: 20px;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('[ForgotPassword] Resend error:', error);
        return NextResponse.json({ 
          error: 'Failed to send email. Please try again.' 
        }, { status: 500 });
      }

      console.log(`[ForgotPassword] OTP sent successfully to: ${email}`);
      
      return NextResponse.json({ 
        message: 'If an account exists, we\'ve sent a verification code.',
        googleAccount: isGoogleUser,
      });

    } catch (emailError) {
      console.error('[ForgotPassword] Email send error:', emailError);
      return NextResponse.json({ 
        error: 'Failed to send email. Please try again.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[ForgotPassword] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}