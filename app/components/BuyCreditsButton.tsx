'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import BuyCreditsModal from './BuyCreditsModal';

export default function BuyCreditsButton({ currentCredits }: { currentCredits: number }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 bg-[#0D4F4F] text-white px-4 py-2 rounded-xl font-semibold shadow-md hover:shadow-lg transition"
      >
        <Plus size={16} /> Buy Credits
      </button>
      <BuyCreditsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentCredits={currentCredits}
      />
    </>
  );
}