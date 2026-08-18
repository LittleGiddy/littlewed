// lib/utils.ts

/**
 * Generate a unique pass code for guests
 * Format: WED-XXXX (e.g., WED-8F92)
 */
export function generatePassCode(): string {
  const prefix = 'WED';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

/**
 * Generate a unique pass code that doesn't exist in the database
 */
export async function generateUniquePassCode(prisma: any): Promise<string> {
  let passCode: string;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (exists && attempts < maxAttempts) {
    passCode = generatePassCode();
    const existing = await prisma.guest.findUnique({
      where: { passCode },
    });
    exists = !!existing;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique pass code');
  }
  
  return passCode!;
}