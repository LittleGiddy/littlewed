import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { guestId, status, dietary, plusOne } = await req.json()
  
  await prisma.guest.update({
    where: { id: guestId },
    data: { 
      attending: status,
      // You'd add dietary and plusOne fields to schema
    }
  })
  
  return NextResponse.json({ success: true })
}