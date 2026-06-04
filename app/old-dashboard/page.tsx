import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = session.user.id as string
  
  const [events, guests, rsvpYes, checkedIn] = await Promise.all([
    prisma.event.count({ where: { userId } }),
    prisma.guest.count({ where: { event: { userId } } }),
    prisma.guest.count({ where: { event: { userId }, attending: 'yes' } }),
    prisma.guest.count({ where: { event: { userId }, checkedIn: true } })
  ])

  const stats = [
    { label: 'Total Events', value: events, icon: '🎉', color: 'from-blue-500 to-blue-600' },
    { label: 'Total Guests', value: guests, icon: '👥', color: 'from-green-500 to-green-600' },
    { label: 'RSVP Confirmed', value: rsvpYes, icon: '✅', color: 'from-purple-500 to-purple-600' },
    { label: 'Checked In', value: checkedIn, icon: '📍', color: 'from-orange-500 to-orange-600' }
  ]

  const recentEvents = await prisma.event.findMany({
    where: { userId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { guests: true } } }
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {session.user.name || session.user.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`bg-gradient-to-r ${stat.color} rounded-xl shadow-lg p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No events yet. Create your first event!</div>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <h3 className="font-medium text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500">{event._count.guests} guests • {new Date(event.date).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/events/${event.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View →
                  </Link>
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <Link href="/events" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View All Events →
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-3">
            <Link href="/events/new" className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg hover:from-blue-100 hover:to-indigo-100 transition">
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-medium text-gray-900">Create New Event</p>
                <p className="text-sm text-gray-500">Start planning a wedding</p>
              </div>
            </Link>
            <Link href="/guests/import" className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg hover:from-green-100 hover:to-emerald-100 transition">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-medium text-gray-900">Import Guests</p>
                <p className="text-sm text-gray-500">Bulk upload from CSV</p>
              </div>
            </Link>
            <Link href="/invitations/design" className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg hover:from-purple-100 hover:to-pink-100 transition">
              <span className="text-2xl">💌</span>
              <div>
                <p className="font-medium text-gray-900">Design Invitations</p>
                <p className="text-sm text-gray-500">Create QR-coded invites</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

