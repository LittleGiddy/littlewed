import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const guestId = body?.guestId
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!guestId) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Please write a short wish' }, { status: 400 })
  }
  if (message.length > 500) {
    return NextResponse.json({ error: 'Keep your wish under 500 characters' }, { status: 400 })
  }

  const guest = await prisma.guest.findUnique({ where: { id: guestId } })
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  const wish = await prisma.guestWish.create({
    data: {
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      message,
      attending: guest.attending || null,
    },
  })

  return NextResponse.json({ success: true, wish })
}