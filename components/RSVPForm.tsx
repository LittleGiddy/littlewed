'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, Frown, CircleHelp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RSVPForm({ guestId, currentStatus }: { guestId: string; currentStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [dietary, setDietary] = useState('')
  const [plusOne, setPlusOne] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, status, dietary, plusOne })
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
        <label className="block text-sm font-medium text-gray-700 mb-3">Will you be attending?</label>
        <div className="flex gap-4">
          {['yes', 'no', 'pending'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-medium transition ${
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

      {status === 'yes' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Requirements</label>
            <select
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
            >
              <option value="">None</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="halal">Halal</option>
              <option value="gluten-free">Gluten Free</option>
              <option value="allergy">Other Allergy</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="plusOne"
              checked={plusOne}
              onChange={(e) => setPlusOne(e.target.checked)}
              className="w-5 h-5 text-rose-600 rounded"
            />
            <label htmlFor="plusOne" className="text-gray-700">I'm bringing a plus-one</label>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-rose-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-rose-600 hover:to-indigo-700 transition shadow-md"
      >
        {loading ? 'Saving...' : 'Submit RSVP'}
      </button>
    </form>
  )
}