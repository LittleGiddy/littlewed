import africastalking from 'africastalking';
import { prisma } from '@/lib/prisma';

// Read env variables (they can be undefined during build)
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID;

let africastalkingInstance: any = null;
let sms: any = null;

function initAfricastalking() {
  if (!africastalkingInstance) {
    if (!AT_USERNAME || !AT_API_KEY) {
      throw new Error('Missing Africa’s Talking credentials (AT_USERNAME, AT_API_KEY) in .env file');
    }
    africastalkingInstance = africastalking({
      username: AT_USERNAME,
      apiKey: AT_API_KEY,
    });
    sms = africastalkingInstance.SMS;
  }
  return { sms };
}

// Generate a unique numeric code
function generateUniqueCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

// Get unique SMS code for a guest
export async function getUniqueSmsCodeForGuest(guestId: string, eventName: string): Promise<string> {
  let isUnique = false;
  let smsCode = '';

  while (!isUnique) {
    smsCode = generateUniqueCode(6);
    const existingGuest = await prisma.guest.findUnique({
      where: { smsCode: smsCode },
    });
    if (!existingGuest) isUnique = true;
  }

  await prisma.guest.update({
    where: { id: guestId },
    data: { smsCode },
  });

  return smsCode;
}

// Send the SMS with the code (uses sendSms internally)
export async function sendSmsCode(phoneNumber: string, guestName: string, smsCode: string, eventName: string) {
  const message = `Hello ${guestName}, welcome to ${eventName}! Your entry code is: ${smsCode}. Please show this code at the entrance.`;
  return await sendSms(phoneNumber, message);
}

// ✅ Generic SMS sender – credentials checked at runtime
export async function sendSms(phoneNumber: string, message: string) {
  try {
    initAfricastalking();
    if (!AT_SENDER_ID) {
      throw new Error('Missing AT_SENDER_ID in .env file');
    }
    const result = await sms.send({
      to: phoneNumber,
      message: message,
      from: AT_SENDER_ID,
    });
    console.log('SMS sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error };
  }
}