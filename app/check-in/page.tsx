'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react' // ✅ add import

function CheckInContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')
  
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestName, setGuestName] = useState('')

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return

    setLoading(true)
    setMessage('')
    setGuestName('')

    const res = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ✅ add this for session
      body: JSON.stringify({ smsCode: code })
    })

    const data = await res.json()
    if (res.ok) {
      setMessage(`✅ Checked in: ${data.guest.name}`)
      setGuestName(data.guest.name)
      setCode('')
      new Audio('/beep.mp3').play().catch(() => {})
    } else {
      setMessage(`❌ ${data.error}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Venue Check‑In</h1>
        {eventId && <p className="text-center text-gray-500 text-sm mb-6">Event ID: {eventId}</p>}
        
        <form onSubmit={handleCheckIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter 6‑digit code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
              className="w-full p-4 text-3xl text-center font-mono tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition"
          >
            {loading ? 'Checking...' : '✓ Check In'}
          </button>
        </form>
        
        {message && (
          <div className={`mt-6 p-4 rounded-xl text-center font-medium ${
            message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}
        
        {guestName && (
          <div className="mt-4 text-center text-gray-600">
            Welcome, <span className="font-semibold">{guestName}</span>!
          </div>
        )}
      </div>
    </div>
  )
}

// ✅ Wrap in Suspense to fix prerender error
export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CheckInContent />
    </Suspense>
  )
}