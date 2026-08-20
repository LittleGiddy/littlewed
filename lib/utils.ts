// lib/utils.ts
import { prisma } from './prisma';

/**
 * Generate a unique pass code for a guest
 * Format: WED-XXXXXX (e.g., WED-8F92A3)
 */
export async function generateUniquePassCode(prisma: any): Promise<string> {
  let passCode: string;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 20;
  
  while (exists && attempts < maxAttempts) {
    // Generate a 6-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    passCode = `WED-${result}`;
    
    // Check if it exists
    const existing = await prisma.guest.findUnique({
      where: { passCode },
    });
    exists = !!existing;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique pass code after ' + maxAttempts + ' attempts');
  }
  
  return passCode!;
}