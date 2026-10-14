'use client'

import { useCallback, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { CircleCheck, TriangleAlert, Loader2 } from 'lucide-react'
import ScanResultCard, { type ScanResultCardGuest } from '@/app/components/ScanResultCard'
import { useReducedMotion } from '@/lib/motion'

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
  const reducedMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guest, setGuest] = useState<ScanResultCardGuest | null>(null)
  const [doubleBusy, setDoubleBusy] = useState(false)

  // Dismiss the result card and hand the operator straight back to the input so
  // the next card number can be typed without a tap.
  const closeResult = useCallback(() => {
    setGuest(null)
    setError('')
    inputRef.current?.focus()
  }, [])

  const handleCheckIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!code) return

      setLoading(true)
      setNotice('')
      setError('')

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
        setGuest(data.guest)
        setCode('')
        new Audio('/beep.mp3').play().catch(() => {})
      } else {
        playHaptic('fail')
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
      setNotice(data.message || 'Marked as arrived')
      closeResult()
    } catch (err) {
      playHaptic('fail')
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setDoubleBusy(false)
    }
  }

  const handleMarkAllAsGroup = async () => {
    if (!guest) return
    setDoubleBusy(true)
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ checkedIn: true, allGroup: true, label: 'group' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not mark the group')
      playHaptic('success')
      setNotice(data.message || 'Marked as arrived')
      closeResult()
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
      setNotice(data.message || 'Scan undone')
      closeResult()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setDoubleBusy(false)
    }
  }

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
              ref={inputRef}
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

        {notice && !error && (
          <div className="mt-6 p-4 rounded-xl text-center font-medium bg-green-100 text-green-800">
            {notice}
          </div>
        )}
      </div>

      <AnimatePresence>
        {guest ? (
          <ScanResultCard
            key={guest.id}
            guest={guest}
            reducedMotion={reducedMotion}
            doubleBusy={doubleBusy}
            onClose={closeResult}
            onMarkDouble={() => void handleMarkAsDouble()}
            onMarkGroup={() => void handleMarkAllAsGroup()}
            onUndo={() => void handleUndo()}
          />
        ) : null}
      </AnimatePresence>
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
