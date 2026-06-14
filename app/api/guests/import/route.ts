import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// Check if a phone number is on WhatsApp via Twilio lookup
async function isOnWhatsApp(phone: string): Promise<boolean> {
  if (process.env.MOCK_WHATSAPP === 'true') {
    // Mock: assume numbers starting with +2557 are WhatsApp
    return phone.startsWith('+2557');
  }
  try {
    const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`
    const lookup = await twilioClient.lookups.v2
      .phoneNumbers(normalized)
      .fetch({ fields: 'channels' })
    const channels = (lookup as any).channels
    return channels?.whatsapp?.has_whatsapp === true
  } catch (err) {
    console.error(`WhatsApp lookup failed for ${phone}:`, err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = (session.user as any).tenantId

  const formData = await req.formData()
  const file = formData.get('file') as File
  const eventId = formData.get('eventId') as string
  if (!file || !eventId) return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 })

  const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const text = await file.text()
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })
  const guests = result.data as any[]

  const created = []
  const skipped = []
  const whatsappResults: { name: string; phone: string; onWhatsApp: boolean }[] = []

  for (const guest of guests) {
    if (!guest.name) {
      skipped.push(guest)
      continue
    }

    let onWhatsApp = false
    if (guest.phone) {
      console.log(`Checking WhatsApp for ${guest.name} (${guest.phone})...`)
      onWhatsApp = await isOnWhatsApp(guest.phone)
      console.log(`${guest.name}: onWhatsApp = ${onWhatsApp}`)
      whatsappResults.push({ name: guest.name, phone: guest.phone, onWhatsApp })
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const newGuest = await prisma.guest.create({
      data: {
        name: guest.name,
        email: guest.email || null,
        phone: guest.phone || null,
        eventId,
        routingChannel: onWhatsApp ? 'whatsapp' : 'sms',
      },
    })
    created.push({ ...newGuest, onWhatsApp })
  }

  const whatsappCount = whatsappResults.filter(r => r.onWhatsApp).length
  const noWhatsAppCount = whatsappResults.filter(r => !r.onWhatsApp).length
  const noPhoneCount = guests.filter(g => g.name && !g.phone).length

  return NextResponse.json({
    success: true,
    count: created.length,
    skipped: skipped.length,
    whatsapp: {
      checked: whatsappResults.length,
      onWhatsApp: whatsappCount,
      notOnWhatsApp: noWhatsAppCount,
      noPhone: noPhoneCount,
      details: whatsappResults,
    },
  })
}