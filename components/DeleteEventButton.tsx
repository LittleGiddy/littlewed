'use client';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? All guests will be permanently removed.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Event deleted successfully');
        router.push('/client/events');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete event');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2"
    >
      <Trash2 size={16} />
      {deleting ? 'Deleting...' : 'Delete Event'}
    </button>
  );
}