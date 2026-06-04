import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import RSVPForm from '@/components/RSVPForm'
import { notFound } from 'next/navigation'

async function getGuestFromToken(token: string) {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    )
    const guestId = payload.guestId as string
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { event: true }
    })
    return guest
  } catch {
    return null
  }
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const guest = await getGuestFromToken(params.token)
  
  if (!guest) {
    notFound()
  }

  const event = guest.event

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-indigo-600 px-6 py-12 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">You're Invited!</h1>
            <p className="text-rose-100">We joyfully invite you to celebrate with us</p>
          </div>
          
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800">{event.name}</h2>
              <div className="mt-4 space-y-2">
                <p className="text-gray-600 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-gray-600 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.venue}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <RSVPForm guestId={guest.id} currentStatus={guest.attending} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}