'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import BuyCreditsModal from './BuyCreditsModal';

interface BuyCreditsButtonProps {
  currentCredits: number;
  compact?: boolean;
}

export default function BuyCreditsButton({ currentCredits, compact = false }: BuyCreditsButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {compact ? (
        <button
          onClick={() => setModalOpen(true)}
          title="Buy Credits"
          className="inline-flex items-center justify-center gap-1 bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.18)] w-7 h-7 rounded-full font-semibold transition hover:bg-[rgba(13,79,79,0.16)] hover:border-[rgba(13,79,79,0.32)]"
        >
          <Plus size={14} />
        </button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#0D4F4F] text-white px-4 py-2 rounded-xl font-semibold shadow-md hover:shadow-lg transition"
        >
          <Plus size={16} /> Buy Credits
        </button>
      )}

      <BuyCreditsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentCredits={currentCredits}
      />
    </>
  );
}