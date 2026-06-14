import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

async function generateUniqueCode(): Promise<string> {
  let code = '';
  let exists = true;
  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await prisma.guest.findUnique({ where: { smsCode: code } });
    exists = !!existing;
  }
  return code;
}

export async function POST(req: NextRequest) {
  const AT_USERNAME = process.env.AT_USERNAME;
  const AT_API_KEY = process.env.AT_API_KEY;
  const AT_SENDER_ID = process.env.AT_SENDER_ID;

  if (!AT_USERNAME || !AT_API_KEY || !AT_SENDER_ID) {
    console.error('Missing Africa\'s Talking credentials');
    return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
  }

  const africastalking = require('africastalking');
  const at = africastalking({ username: AT_USERNAME, apiKey: AT_API_KEY });
  const sms = at.SMS;

  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { eventId } = await req.json();

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    include: { guests: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const customMessage = event.customMessage || "You're invited!";

  const results = [];
  for (const guest of event.guests) {
    if (guest.phone && !guest.smsCode) {
      try {
        const smsCode = await generateUniqueCode();
        await prisma.guest.update({ where: { id: guest.id }, data: { smsCode } });

        const message = `${customMessage} Hello ${guest.name}, your entry code for ${event.name} is: ${smsCode}. Please show this at the entrance.`;
        const formattedPhone = guest.phone.startsWith('+') ? guest.phone : `+${guest.phone}`;

        const result: any = await sms.send({
          to: formattedPhone,
          message,
          from: AT_SENDER_ID,
        });

        const recipient = result?.SMSMessageData?.Recipients?.[0];
        if (!recipient || recipient.status !== 'Success') {
          throw new Error(recipient?.status || result?.SMSMessageData?.Message || 'SMS failed');
        }

        results.push({ guestId: guest.id, success: true });
      } catch (error: any) {
        console.error(`Failed for ${guest.name}:`, error.message);
        results.push({ guestId: guest.id, success: false, error: error.message });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return NextResponse.json({ success: true, results });
}