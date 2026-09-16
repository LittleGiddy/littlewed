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

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      attending: status,
      // You'd add dietary and plusOne fields to schema
    },
  })

  // Record the submission so tenants can review who replied, when.
  // One current row per guest: drop any previous reply, keep the latest.
  await prisma.rsvp.deleteMany({ where: { eventId: guest.eventId, guestId } })
  await prisma.rsvp.create({
    data: {
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      status,
    },
  })

  return NextResponse.json({ success: true })
}