import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { guestId, status, dietary, plusOne } = await req.json()

  const guest = await prisma.guest.findUnique({ where: { id: guestId } })
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  if (!['yes', 'no', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.guest.update({
      where: { id: guestId },
      data: { attending: status },
    }),
    prisma.rsvp.updateMany({
      where: { eventId: guest.eventId, guestId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.rsvp.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
        status,
        channel: 'WEB',
        isCurrent: true,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}