'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvitationDesigner({ params }: { params: Promise<{ eventId: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState('');
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 80, y: 300, size: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(({ eventId }) => setEventId(eventId));
  }, [params]);

  // Force trigger file input on div click
  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Upload area clicked, triggering file input');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('fileInputRef is null');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type);
      const reader = new FileReader();
      reader.onload = (ev) => {
        console.log('File read complete, setting card image');
        setCardImage(ev.target?.result as string);
      };
      reader.onerror = (err) => console.error('File read error:', err);
      reader.readAsDataURL(file);
    } else {
      console.log('No file selected');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - qrPosition.x,
      y: e.clientY - rect.top - qrPosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;
    newX = Math.min(Math.max(0, newX), rect.width - qrPosition.size);
    newY = Math.min(Math.max(0, newY), rect.height - qrPosition.size);
    setQrPosition(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleGenerate = async () => {
    if (!cardImage) return;
    setGenerating(true);
    try {
      console.log('Uploading base card...');
      const uploadRes = await fetch('/api/upload-base-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, image: cardImage }),
        credentials: 'include',
      });
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} - ${errorText}`);
      }
      const { url } = await uploadRes.json();
      console.log('Base card uploaded, URL:', url);

      console.log('Generating QR codes...');
      const genRes = await fetch('/api/invitations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, qrPosition, baseCardUrl: url }),
        credentials: 'include',
      });
      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'Generation failed');
      }
      console.log('QR generation successful, redirecting...');
      router.push(`/invitations/send/${eventId}`);
    } catch (error: any) {
      console.error('Generation error:', error);
      alert('Generation failed: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">Design Invitation</h1>
          <p className="text-gray-600 mt-2">Upload your card, drag QR code to desired position</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side: upload and controls */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Upload Card Design</h2>
              <div
                onClick={handleUploadClick}
                className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition bg-indigo-50/30"
              >
                {cardImage ? (
                  <div>
                    <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-600 font-medium">Card uploaded</p>
                    <button className="text-sm text-indigo-600 mt-1" onClick={(e) => { e.stopPropagation(); setCardImage(null); }}>Change</button>
                  </div>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600">Click to upload PNG or JPG</p>
                    <p className="text-xs text-gray-400 mt-1">Recommended: 1080x1350px</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">2. QR Code Settings</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">QR Size (px)</label>
                <input
                  type="range" min="60" max="200" value={qrPosition.size}
                  onChange={(e) => setQrPosition({ ...qrPosition, size: Number(e.target.value) })}
                  className="w-full mt-1"
                />
                <span className="text-sm text-gray-500">{qrPosition.size}px</span>
              </div>
            </div>

            {cardImage && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
              >
                {generating ? 'Generating QR codes...' : '✨ Generate QR Codes for All Guests'}
              </button>
            )}
          </div>

          {/* Right side: preview with draggable QR */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Preview</h2>
            {cardImage ? (
              <div
                ref={canvasRef}
                className="relative rounded-lg overflow-hidden shadow-md"
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <img src={cardImage} alt="Card" className="w-full h-auto" />
                <div
                  className="absolute border-2 border-white rounded-lg shadow-lg cursor-move bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-xs font-mono"
                  style={{
                    width: qrPosition.size,
                    height: qrPosition.size,
                    left: qrPosition.x,
                    top: qrPosition.y,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  QR
                </div>
              </div>
            ) : (
              <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                Upload card to see preview
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">Drag the QR box to reposition</p>
          </div>
        </div>
      </div>
    </div>
  );
}