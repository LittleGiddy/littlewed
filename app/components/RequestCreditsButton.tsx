'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import RequestCreditsModal from './RequestCreditsModal';

interface RequestCreditsButtonProps {
  compact?: boolean;
  hasPending?: boolean;
  onRequestSent?: () => void;
}

export default function RequestCreditsButton({ compact = false, hasPending = false, onRequestSent }: RequestCreditsButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {compact ? (
        <button
          onClick={() => setModalOpen(true)}
          title={hasPending ? 'Request pending' : 'Request Credits'}
          className={`inline-flex items-center justify-center gap-1 w-7 h-7 rounded-full font-semibold transition border ${
            hasPending
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'bg-[rgba(13,75,75,0.08)] text-[#0D4B4B] border-[rgba(13,75,75,0.18)] hover:bg-[rgba(13,75,75,0.16)] hover:border-[rgba(13,75,75,0.32)]'
          }`}
        >
          <Plus size={14} />
        </button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold shadow-md transition ${
            hasPending
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-[#0D4B4B] text-white hover:shadow-lg'
          }`}
        >
          <Plus size={16} /> {hasPending ? 'Request Pending' : 'Request Credits'}
        </button>
      )}

      <RequestCreditsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRequestSent={onRequestSent}
        hasPending={hasPending}
      />
    </>
  );
}
