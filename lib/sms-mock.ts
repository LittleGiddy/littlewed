// lib/sms-mock.ts
import { prisma } from '@/lib/prisma';

/**
 * Generate a unique 5-digit card number for a guest
 * @param eventId - The event ID to check for existing card numbers
 * @returns A unique 5-digit card number
 */
export async function generateUniqueCardNumber(eventId: string): Promise<string> {
  // Get all existing card numbers for this event
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { cardNumber: true },
  });

  // Extract numeric card numbers
  const numbers: number[] = [];
  for (const guest of guests) {
    if (guest.cardNumber !== null) {
      const num = parseInt(guest.cardNumber, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  numbers.sort((a, b) => a - b);

  // Find the next available number
  let nextNumber = 1;
  for (const num of numbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else if (num > nextNumber) {
      break;
    }
  }

  // Pad to 5 digits
  return nextNumber.toString().padStart(5, '0');
}

/**
 * Get a unique card number for a guest and update their record
 * @param guestId - The guest ID
 * @param eventId - The event ID
 * @returns The unique card number
 */
export async function getUniqueCardNumberForGuest(
  guestId: string,
  eventId: string
): Promise<string> {
  const cardNumber = await generateUniqueCardNumber(eventId);
  
  await prisma.guest.update({
    where: { id: guestId },
    data: { cardNumber },
  });
  
  return cardNumber;
}

/**
 * Send a mock SMS with the card number (for development/testing)
 * @param phoneNumber - The recipient's phone number
 * @param guestName - The guest's name
 * @param cardNumber - The 5-digit card number
 * @param eventName - The event name
 * @returns Success status
 */
export async function sendMockSmsWithCardNumber(
  phoneNumber: string,
  guestName: string,
  cardNumber: string,
  eventName: string
) {
  // Log the message to your console instead of sending a real SMS
  console.log(`[MOCK SMS] To: ${phoneNumber}`);
  console.log(`[MOCK SMS] Card Number: ${cardNumber}`);
  console.log(`[MOCK SMS] Message: "Hello ${guestName}, your entry card number for ${eventName} is: ${cardNumber}."`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return { success: true };
}

/**
 * Send a mock SMS with a custom message (for development/testing)
 * @param phoneNumber - The recipient's phone number
 * @param message - The message to send
 * @returns Success status
 */
export async function sendMockSms(
  phoneNumber: string,
  message: string
) {
  console.log(`[MOCK SMS] To: ${phoneNumber}`);
  console.log(`[MOCK SMS] Message: ${message}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return { success: true };
}

// ─── Legacy functions (deprecated) ──────────────────────────────────────

/**
 * @deprecated Use getUniqueCardNumberForGuest instead
 */
export async function getUniqueSmsCodeForGuest(
  guestId: string,
  eventName: string
): Promise<string> {
  console.warn('[DEPRECATED] getUniqueSmsCodeForGuest is deprecated. Use getUniqueCardNumberForGuest instead.');
  
  // Fallback: Try to find the event ID from the guest
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { eventId: true },
  });
  
  if (!guest) {
    throw new Error('Guest not found');
  }
  
  return await getUniqueCardNumberForGuest(guestId, guest.eventId);
}

/**
 * @deprecated Use sendMockSmsWithCardNumber instead
 */
export async function sendSmsCode(
  phoneNumber: string,
  guestName: string,
  smsCode: string,
  eventName: string
) {
  console.warn('[DEPRECATED] sendSmsCode is deprecated. Use sendMockSmsWithCardNumber instead.');
  return await sendMockSmsWithCardNumber(phoneNumber, guestName, smsCode, eventName);
}