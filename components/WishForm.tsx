'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Heart, Loader2 } from 'lucide-react'

export default function WishForm({
  guestId,
  primaryColor,
  secondaryColor,
}: {
  guestId: string
  primaryColor?: string
  secondaryColor?: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Please write a short wish for the couple')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/rsvp/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, message: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Thank you! Your wish has been shared.')
        setMessage('')
        router.refresh()
      } else {
        toast.error(data.error || 'Could not save your wish. Please try again.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Share a wedding wish for the couple..."
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition resize-none"
        />
        <span className="absolute bottom-2 right-3 text-[10px] text-gray-300">{message.length}/500</span>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition shadow-md disabled:opacity-50"
        style={
          primaryColor && secondaryColor
            ? { backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }
            : undefined
        }
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
        {loading ? 'Sharing...' : 'Share your wish'}
      </button>
    </form>
  )
}