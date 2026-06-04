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
  try {
    // Normalize phone number to E.164 format
    const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`

    const lookup = await twilioClient.lookups.v2
      .phoneNumbers(normalized)
      .fetch({ fields: 'channels' })

    // channels.whatsapp.has_whatsapp is true if number is on WhatsApp
    const channels = (lookup as any).channels
    return channels?.whatsapp?.has_whatsapp === true
  } catch (err) {
    // If lookup fails (invalid number, etc.), assume not on WhatsApp
    console.error(`WhatsApp lookup failed for ${phone}:`, err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const eventId = formData.get('eventId') as string

  if (!file || !eventId) {
    return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 })
  }

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

    // Only check WhatsApp if phone number is provided
    if (guest.phone) {
      console.log(`Checking WhatsApp for ${guest.name} (${guest.phone})...`)
      onWhatsApp = await isOnWhatsApp(guest.phone)
      console.log(`${guest.name}: onWhatsApp = ${onWhatsApp}`)

      whatsappResults.push({
        name: guest.name,
        phone: guest.phone,
        onWhatsApp,
      })
    }

    const newGuest = await prisma.guest.create({
      data: {
        name: guest.name,
        email: guest.email || null,
        phone: guest.phone || null,
        eventId: eventId,
        // Store WhatsApp status — add `onWhatsApp Boolean @default(false)` to your Guest model
        // onWhatsApp,
      },
    })

    created.push({ ...newGuest, onWhatsApp })
  }

  // Summary
  const whatsappCount = whatsappResults.filter((r) => r.onWhatsApp).length
  const noWhatsAppCount = whatsappResults.filter((r) => !r.onWhatsApp).length
  const noPhoneCount = guests.filter((g) => g.name && !g.phone).length

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