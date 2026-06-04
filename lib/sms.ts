import africastalking from 'africastalking';
import { prisma } from '@/lib/prisma';

// Validate environment variables
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID;

if (!AT_USERNAME || !AT_API_KEY || !AT_SENDER_ID) {
  throw new Error('Missing Africa’s Talking credentials in .env file');
}

const africastalkingInstance = africastalking({
  username: AT_USERNAME,
  apiKey: AT_API_KEY,
});

const sms = africastalkingInstance.SMS;

// Generate a unique numeric code
function generateUniqueCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

// Get unique SMS code for a guest (ensures no duplicates)
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

// Send the SMS with the code
export async function sendSmsCode(phoneNumber: string, guestName: string, smsCode: string, eventName: string) {
  const message = `Hello ${guestName}, welcome to ${eventName}! Your entry code is: ${smsCode}. Please show this code at the entrance.`;

  try {
    const result = await sms.send({
      to: phoneNumber,
      message: message,
      from:  process.env.AT_SENDER_ID!, // now guaranteed to be a string
    });
    console.log('SMS sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error };
  }
}