import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function EventsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const events = await prisma.event.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'asc' }
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Events</h1>
        <Link href="/events/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No events yet. Create your first event!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{event.name}</h3>
                <p className="text-gray-600">{new Date(event.date).toLocaleDateString()} at {event.venue}</p>
              </div>
              <Link href={`/events/${event.id}`} className="text-blue-600 hover:underline">
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

