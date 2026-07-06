import africastalking from 'africastalking';
import { prisma } from '@/lib/prisma';

let africastalkingInstance: any = null;
let sms: any = null;

function initAfricastalking() {
  if (!africastalkingInstance) {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    if (!username || !apiKey) {
      throw new Error('Missing Africa\'s Talking credentials (AT_USERNAME, AT_API_KEY)');
    }
    africastalkingInstance = africastalking({ username, apiKey });
    sms = africastalkingInstance.SMS;
  }
  return { sms };
}

function generateUniqueCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

export async function getUniqueSmsCodeForGuest(guestId: string, eventName: string): Promise<string> {
  let isUnique = false;
  let smsCode = '';
  while (!isUnique) {
    smsCode = generateUniqueCode(6);
    const existing = await prisma.guest.findUnique({ where: { smsCode } });
    if (!existing) isUnique = true;
  }
  await prisma.guest.update({ where: { id: guestId }, data: { smsCode } });
  return smsCode;
}

export async function sendSmsCode(phoneNumber: string, guestName: string, smsCode: string, eventName: string) {
  const message = `Hello ${guestName}, welcome to ${eventName}! Your entry code is: ${smsCode}. Please show this code at the entrance.`;
  return sendSms(phoneNumber, message);
}

export async function sendSms(phoneNumber: string, message: string) {
  try {
    initAfricastalking();
    const senderId = process.env.AT_SENDER_ID;
    if (!senderId) throw new Error('Missing AT_SENDER_ID in .env');
    const result = await sms.send({
      to: phoneNumber,
      message,
      from: senderId,
    });
    // Return the full response for the caller to parse
    return { success: true, result };
  } catch (error) {
    console.error('SMS send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown SMS error',
    };
  }
}