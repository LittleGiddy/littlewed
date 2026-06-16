import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

const parseCSV = (buffer: Buffer): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(buffer.toString(), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as any[]),
      error: (err: Error) => reject(err),
    });
  });
};

const parseVCard = (text: string): { name: string; phone: string; email?: string }[] => {
  const guests: { name: string; phone: string; email?: string }[] = [];
  const cards = text.split(/BEGIN:VCARD/i).filter((card: string) => card.trim());

  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    let name = '';
    let phone = '';
    let email = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
        const parts = trimmed.split(':');
        if (parts.length > 1) name = parts.slice(1).join(':').trim();
      } else if (trimmed.startsWith('N:') || trimmed.startsWith('N;')) {
        const parts = trimmed.split(':');
        if (parts.length > 1) {
          const nameParts = parts.slice(1).join(':').split(';');
          if (nameParts.length >= 2) {
            const first = nameParts[1]?.trim() || '';
            const last = nameParts[0]?.trim() || '';
            if (first || last) name = `${first} ${last}`.trim();
          }
        }
      } else if (trimmed.startsWith('TEL') && !phone) {
        const parts = trimmed.split(':');
        if (parts.length > 1) {
          phone = parts.slice(1).join(':').trim();
        }
      } else if (trimmed.startsWith('EMAIL') && !email) {
        const parts = trimmed.split(':');
        if (parts.length > 1) {
          email = parts.slice(1).join(':').trim();
        }
      }
    }

    if (name && phone) {
      guests.push({ name, phone, email: email || undefined });
    }
  }

  return guests;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string;

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { tenant: { select: { bypassPayment: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rawGuests: { name: string; phone: string; email?: string }[] = [];
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'csv') {
        const data = await parseCSV(buffer);
        rawGuests = data
          .map((row: any) => ({
            name: row.name || row.Name || row.fullName || '',
            phone: row.phone || row.Phone || row.phoneNumber || '',
            email: row.email || row.Email || '',
          }))
          .filter((g: { name: string; phone: string }) => g.name && g.phone);
      } else if (ext === 'vcf') {
        const text = buffer.toString('utf-8');
        rawGuests = parseVCard(text);
      } else {
        return NextResponse.json({ error: 'Unsupported file format. Use CSV or VCF.' }, { status: 400 });
      }
    } catch (parseErr: any) {
      console.error('Parse error:', parseErr);
      return NextResponse.json({ error: 'Failed to parse file: ' + (parseErr.message || 'unknown') }, { status: 500 });
    }

    if (rawGuests.length === 0) {
      return NextResponse.json({ error: 'No valid guest records found in file. Ensure CSV has name and phone columns.' }, { status: 400 });
    }

    // Normalize phones: only accept +255...
    const normalizedGuests = rawGuests.map(g => {
      const result = normalizePhone(g.phone);
      return {
        ...g,
        phoneNormalized: result.normalized,
        phoneValid: result.isValid,
        phoneOriginal: g.phone,
      };
    });

    const invalidGuests = normalizedGuests.filter(g => !g.phoneValid);
    const validGuests = normalizedGuests.filter(g => g.phoneValid);

    if (validGuests.length === 0) {
      return NextResponse.json({
        error: `No valid guest numbers found. ${invalidGuests.length} entries had invalid phone numbers. Numbers must start with '+' and include the country code (e.g., +255712345678).`,
        invalidCount: invalidGuests.length,
      }, { status: 400 });
    }

    // Check guest limit (only if not bypass)
    if (!event.tenant?.bypassPayment && event.guestCount) {
      const currentGuests = await prisma.guest.count({ where: { eventId } });
      if (currentGuests + validGuests.length > event.guestCount) {
        const remaining = Math.max(0, event.guestCount - currentGuests);
        return NextResponse.json({
          error: `Exceeds guest limit of ${event.guestCount}. You can add up to ${remaining} more guests.`,
        }, { status: 400 });
      }
    }

    // Duplicate detection using normalized phone
    const normalizedPhoneNumbers = validGuests.map(g => g.phoneNormalized);
    const existingGuests = await prisma.guest.findMany({
      where: {
        eventId,
        phone: { in: normalizedPhoneNumbers },
      },
      select: { phone: true, name: true },
    });

    const existingPhones = new Set(existingGuests.map(g => g.phone));
    const duplicateNames: string[] = [];
    const uniqueGuests = validGuests.filter(g => {
      if (existingPhones.has(g.phoneNormalized)) {
        duplicateNames.push(g.name);
        return false;
      }
      return true;
    });

    if (uniqueGuests.length === 0) {
      return NextResponse.json({
        count: 0,
        skipped: validGuests.length,
        duplicateNames: existingGuests.map(g => g.name),
        invalidCount: invalidGuests.length,
        message: 'All valid guests are duplicates. No new guests added.',
      });
    }

    // Insert unique guests
    const guestsToInsert = uniqueGuests.map((g) => ({
      name: g.name,
      phone: g.phoneNormalized, // stored with '+'
      email: g.email || null,
      eventId,
      routingChannel: 'sms',
      smsCode: randomBytes(4).toString('hex').toUpperCase(),
      qrToken: randomBytes(16).toString('hex'),
    }));

    const result = await prisma.guest.createMany({
      data: guestsToInsert,
      skipDuplicates: true,
    });

    return NextResponse.json({
      count: result.count,
      skipped: validGuests.length - result.count,
      invalidCount: invalidGuests.length,
      duplicateNames: existingGuests.map(g => g.name),
      message: result.count > 0
        ? `Imported ${result.count} guest${result.count > 1 ? 's' : ''}${(validGuests.length - result.count) > 0 ? `, skipped ${validGuests.length - result.count} duplicate${(validGuests.length - result.count) > 1 ? 's' : ''}` : ''}${invalidGuests.length > 0 ? `, ${invalidGuests.length} invalid number${invalidGuests.length > 1 ? 's' : ''} skipped` : ''}`
        : `No new guests imported (all ${validGuests.length} were duplicates${invalidGuests.length > 0 ? `, ${invalidGuests.length} invalid numbers` : ''})`,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'unknown') },
      { status: 500 }
    );
  }
}