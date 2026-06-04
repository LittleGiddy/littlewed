import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import africastalking from 'africastalking';

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env file`);
  return value;
}

const at = africastalking({
  apiKey: getEnvVar('AT_API_KEY'),
  username: getEnvVar('AT_USERNAME'),
});

const sms = at.SMS;

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

async function sendSms(phone: string, name: string, code: string, eventName: string) {
  const message = `Hello ${name}, your entry code for ${eventName} is: ${code}. Please show this at the entrance.`;
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const result: any = await sms.send({
    to: formattedPhone,
    message,
  } as any);

  const recipient = result?.SMSMessageData?.Recipients?.[0];
  if (!recipient || recipient.status !== 'Success') {
    throw new Error(recipient?.status || result?.SMSMessageData?.Message || 'SMS failed');
  }

  return result;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await req.json();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { guests: true }
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const results = [];
  for (const guest of event.guests) {
    if (guest.phone && !guest.smsCode) {
      try {
        const smsCode = await generateUniqueCode();
        await prisma.guest.update({
          where: { id: guest.id },
          data: { smsCode }
        });
        await sendSms(guest.phone, guest.name, smsCode, event.name);
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