import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER!;

const client = twilio(accountSid, authToken);

export async function POST(req: NextRequest) {
  try {
    const { toNumber, message, imageUrl } = await req.json();

    if (!toNumber || !message || !imageUrl) {
      return NextResponse.json({ error: 'Missing toNumber, message, or imageUrl' }, { status: 400 });
    }

    const formattedTo = toNumber.startsWith('+') ? toNumber : `+${toNumber}`;

    const twilioMessage = await client.messages.create({
      body: message,
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${formattedTo}`,
      mediaUrl: [imageUrl], // this sends the image
    });

    console.log(`✅ Image message sent! SID: ${twilioMessage.sid}`);
    return NextResponse.json({ success: true, messageSid: twilioMessage.sid });
  } catch (error: any) {
    console.error('Twilio error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}