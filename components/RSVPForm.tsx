'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, Frown, CircleHelp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RSVPForm({ guestId, currentStatus, primaryColor, secondaryColor }: { guestId: string; currentStatus: string; primaryColor?: string; secondaryColor?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, status })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Thank you! Your RSVP has been saved.')
        router.refresh()
      } else {
        toast.error(data.error || 'Failed to save your RSVP. Please try again.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-3">Will you be attending?</label>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {['yes', 'no', 'pending'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`inline-flex flex-1 min-w-[7rem] items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-full font-medium transition ${
                status === option
                  ? option === 'yes' ? 'bg-green-600 text-white' : option === 'no' ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option === 'yes' ? (<><PartyPopper size={16} /> Yes, I&apos;ll attend</>) : option === 'no' ? (<><Frown size={16} /> Sadly, no</>) : (<><CircleHelp size={16} /> Maybe</>)}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition shadow-md disabled:opacity-50"
        style={
          primaryColor && secondaryColor
            ? { backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }
            : undefined
        }
      >
        {loading ? 'Saving...' : 'Submit RSVP'}
      </button>
    </form>
  )
}