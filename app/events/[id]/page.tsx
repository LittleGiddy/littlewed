import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SendSmsButton from '@/components/SendSmsButton'

// params is a Promise in Next.js 15+
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  // Await params to get the id
  const { id } = await params

  // Fetch event with guests
  const event = await prisma.event.findUnique({
    where: { id },
    include: { guests: true }
  })

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="text-2xl font-semibold text-gray-700">Event not found</h2>
        <Link href="/events" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Back to events
        </Link>
      </div>
    )
  }

  // Safe calculations
  const guests = event.guests || []
  const checkedInCount = guests.filter(g => g.checkedIn === true).length
  const rsvpYesCount = guests.filter(g => g.attending === 'yes').length
  const guestsWithPhone = guests.filter(g => g.phone).length
  const codesSent = guests.filter(g => g.smsCode).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700">
          ← All events
        </Link>
        <h1 className="text-3xl font-serif font-medium text-gray-900 mt-2">{event.name}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-gray-600">
          <span>{new Date(event.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
          <span>•</span>
          <span>{event.venue}</span>
        </div>
        <p className="text-gray-500 text-sm mt-1">{event.address}</p>
      </div>

      {/* Stats cards - elegant minimal */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-light text-gray-800">{guests.length}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Guests</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-light text-green-700">{rsvpYesCount}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Attending</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-light text-blue-700">{checkedInCount}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Checked in</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-light text-purple-700">{guestsWithPhone}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">With phone</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
          <div className="text-2xl font-light text-amber-700">{codesSent}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">SMS sent</div>
        </div>
      </div>

      {/* Action buttons - subtle */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href={`/guests/import/${event.id}`}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Import CSV
        </Link>
        <Link
          href={`/guests/add/${event.id}`}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Add guest
        </Link>
        <SendSmsButton eventId={event.id} />
        <Link
          href={`/check-in?event=${event.id}`}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Check-in
        </Link>
      </div>

      {/* Guest table - clean */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Guest list</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SMS code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No guests yet. Import a CSV or add manually.
                   </td>
                </tr>
              ) : (
                guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{guest.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 font-mono text-xs">{guest.phone || '—'}</td>
                    <td className="px-6 py-3 text-sm">
                      {guest.attending === 'yes' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Attending</span>
                      ) : guest.attending === 'no' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Declined</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">{guest.smsCode || '—'}</td>
                    <td className="px-6 py-3 text-sm">
                      {guest.checkedIn ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-300">○</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}