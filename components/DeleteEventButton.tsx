'use client';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ok = await confirmToast({
      title: 'Delete this event?',
      message: 'This action cannot be undone. All guests will be permanently removed.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
      className="bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center flex-shrink-0
                 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:gap-2"
      title="Delete Event"
    >
      <Trash2 size={16} />
      <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete Event'}</span>
    </button>
  );
}