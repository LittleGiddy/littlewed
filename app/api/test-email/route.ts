import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: 'LittleWed <noreply@littlewed.co.tz>',
      to: [email],
      subject: 'Test email from LittleWed',
      html: '<p>If you received this, email sending works.</p>',
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
