'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddGuestPage({ params }: { params: { eventId: string } }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    let res
    let errorText = 'Failed to add guest'
    try {
      res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, eventId: params.eventId })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.error) errorText = data.error
      }
    } catch {
      errorText = 'Network error. Please try again.'
    }
    if (res?.ok) {
      toast.success('Guest added')
      router.push(`/events/${params.eventId}`)
    } else {
      toast.error(errorText)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Guest</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="tel" placeholder="Phone (e.g., 0712345678)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded" required />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">Add Guest</button>
      </form>
    </div>
  )
}