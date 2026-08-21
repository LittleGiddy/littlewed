'use client';
import { useState } from 'react';
import { X, Download, Share2, Maximize, Minimize, QrCode, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface CardViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardUrl: string;
  guestName: string;
  cardNumber?: string;
}

export function CardViewerModal({ isOpen, onClose, cardUrl, guestName, cardNumber }: CardViewerModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(cardUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invitation-${guestName.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Card downloaded!');
    } catch (error) {
      toast.error('Failed to download card');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Invitation for ${guestName}`,
          text: `Check out this invitation card for ${guestName}`,
          url: cardUrl,
        });
      } else {
        await navigator.clipboard.writeText(cardUrl);
        toast.success('Card URL copied to clipboard!');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{guestName}</h3>
            {cardNumber && (
              <p className="text-xs text-gray-400 font-mono">Card #{cardNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleDownload}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-[#0D4F4F] hover:bg-gray-100 rounded-lg transition"
              title="Download Card"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-[#0D4F4F] hover:bg-gray-100 rounded-lg transition"
              title="Share Card"
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-[#0D4F4F] hover:bg-gray-100 rounded-lg transition"
              title={isZoomed ? 'Zoom Out' : 'Zoom In'}
            >
              {isZoomed ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className={`p-4 sm:p-6 overflow-auto flex items-center justify-center ${isZoomed ? 'max-h-[75vh]' : 'max-h-[60vh]'}`}>
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#0D4F4F] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={cardUrl}
              alt={`Invitation for ${guestName}`}
              className={`rounded-lg shadow-lg object-contain transition-all duration-300 ${isZoomed ? 'max-h-[70vh] max-w-full' : 'max-h-[55vh] max-w-full'}`}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <QrCode size={12} className="text-[#0D4F4F]" />
            <span>Scan QR code for check-in</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={12} />
            <span>Show this card at the entrance</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}