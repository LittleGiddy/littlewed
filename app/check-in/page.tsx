'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { CircleCheck, TriangleAlert, Users, Undo2, Loader2 } from 'lucide-react'
import { canMarkAsDouble } from '@/lib/checkin'

interface ScanGuest {
  id: string
  name: string
  cardNumber: string | null
  guestType: string | null
  guestCount: number | null
  checkInCount: number
  maxCheckIns: number
  fullyCheckedIn: boolean
  sharedGroup?: boolean
  groupMembers?: { id: string; name: string; checkedIn: boolean }[]
}

function playHaptic(type: 'success' | 'fail') {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    navigator.vibrate(type === 'success' ? [18, 60, 18] : [45, 70, 45])
  } catch {
    /* vibration is a nicety */
  }
}

function CheckInContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')

  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [guest, setGuest] = useState<ScanGuest | null>(null)
  const [doubleBusy, setDoubleBusy] = useState(false)
  const [undone, setUndone] = useState(false)

  const handleCheckIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!code) return

      setLoading(true)
      setMessage('')
      setError('')
      setUndone(false)

      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // The API reads `cardNumber` (5 digits). This page used to send
        // `smsCode`, which the API has never looked at, so every submission
        // came back "Guest not found".
        body: JSON.stringify({ cardNumber: code.trim().padStart(5, '0') }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        playHaptic('success')
        setIsSuccess(true)
        setGuest(data.guest)
        setMessage(data.message || `Checked in: ${data.guest.name}`)
        setCode('')
        new Audio('/beep.mp3').play().catch(() => {})
      } else {
        playHaptic('fail')
        setIsSuccess(false)
        setGuest(null)
        setError(data.error || 'Check-in failed')
      }
      setLoading(false)
    },
    [code]
  )

  // Same "both arrived together" shortcut as the main station.
  const handleMarkAsDouble = async () => {
    if (!guest) return
    setDoubleBusy(true)
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ checkedIn: true, allGroup: true, label: 'double' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not mark as double')
      playHaptic('success')
      setMessage(data.message || 'Marked as arrived')
      setGuest((g) => (g ? { ...g, fullyCheckedIn: true, checkInCount: g.maxCheckIns } : g))
    } catch (err) {
      playHaptic('fail')
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setDoubleBusy(false)
    }
  }

  const handleUndo = async () => {
    if (!guest) return
    setDoubleBusy(true)
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ undo: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not undo')
      setUndone(true)
      setGuest(null)
      setMessage('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setDoubleBusy(false)
    }
  }

  const offerDouble = guest ? canMarkAsDouble(guest) : false

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Venue Check-In</h1>
        {eventId && <p className="text-center text-gray-500 text-sm mb-6">Event ID: {eventId}</p>}

        <form onSubmit={handleCheckIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter the 5-digit card number
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className="w-full p-4 text-3xl text-center font-mono tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="00000"
              maxLength={5}
              inputMode="numeric"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 5}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Checking...
              </>
            ) : (
              <>
                <CircleCheck size={20} /> Check In
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 rounded-xl text-center font-medium bg-red-100 text-red-800 flex items-center justify-center gap-2">
            <TriangleAlert size={18} /> {error}
          </div>
        )}

        {message && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-xl text-center font-medium ${
              isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </motion.div>
        )}

        {guest && !undone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-3"
          >
            <p className="text-center text-gray-600">
              Welcome, <span className="font-semibold">{guest.name}</span>!
            </p>

            {offerDouble ? (
              <>
                <button
                  type="button"
                  onClick={handleMarkAsDouble}
                  disabled={doubleBusy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-50 transition hover:bg-green-700"
                >
                  {doubleBusy ? <Loader2 size={20} className="animate-spin" /> : <Users size={20} />}
                  Mark as Double
                </button>
                <p className="text-center text-xs text-gray-500 leading-snug">
                  Both people arrived together - mark the whole card in one tap instead of
                  scanning again.
                </p>
              </>
            ) : null}

            <button
              type="button"
              onClick={handleUndo}
              disabled={doubleBusy}
              className="w-full inline-flex items-center justify-center gap-2 text-gray-500 text-sm font-semibold py-2 disabled:opacity-50 transition hover:text-gray-800"
            >
              <Undo2 size={16} /> Undo this scan
            </button>
          </motion.div>
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
