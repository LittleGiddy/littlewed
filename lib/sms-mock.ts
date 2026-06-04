// lib/sms-mock.ts
import { prisma } from '@/lib/prisma';

export async function getUniqueSmsCodeForGuest(guestId: string, eventName: string): Promise<string> {
  let isUnique = false;
  let smsCode = '';
  while (!isUnique) {
    smsCode = Math.floor(100000 + Math.random() * 900000).toString();
    const existingGuest = await prisma.guest.findUnique({ where: { smsCode } });
    if (!existingGuest) isUnique = true;
  }
  await prisma.guest.update({ where: { id: guestId }, data: { smsCode } });
  return smsCode;
}

export async function sendSmsCode(phoneNumber: string, guestName: string, smsCode: string, eventName: string) {
  // Log the message to your console instead of sending a real SMS
  console.log(`[MOCK SMS] To: ${phoneNumber}, Code: ${smsCode}, Message: "Hello ${guestName}, your entry code for ${eventName} is: ${smsCode}."`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return { success: true };
}