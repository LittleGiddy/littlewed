'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvitationDesignerSimple({ params }: { params: Promise<{ eventId: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 80, y: 300, size: 120 });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    params.then(({ eventId }) => setEventId(eventId));
  }, [params]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !eventId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('eventId', eventId);
    const res = await fetch('/api/upload-base-card', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      setUploadedUrl(data.url);
      alert('Base card uploaded successfully!');
    } else {
      alert('Upload failed: ' + data.error);
    }
    setUploading(false);
  };

  const handleGenerate = async () => {
    if (!uploadedUrl) return;
    setGenerating(true);
    const genRes = await fetch('/api/invitations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, qrPosition, baseCardUrl: uploadedUrl }),
    });
    if (genRes.ok) {
      router.push(`/send-invitations-server/${eventId}`);
    } else {
      const err = await genRes.json();
      alert('Generation failed: ' + err.error);
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">Design Invitation</h1>
          <p className="text-gray-600 mt-2">Upload your card, then position QR code</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Upload Card Design</h2>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="mb-3 block w-full text-sm text-gray-500"
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Card'}
              </button>
              {uploadedUrl && (
                <p className="text-green-600 text-sm mt-2">✓ Card uploaded successfully</p>
              )}
            </div>

            {uploadedUrl && (
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
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
                >
                  {generating ? 'Generating QR codes...' : '✨ Generate QR Codes for All Guests'}
                </button>
              </div>
            )}
          </div>

          {/* Right side: preview */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Preview</h2>
            {previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="Card preview" className="w-full rounded-lg" />
                <div
                  className="absolute border-2 border-white rounded-lg bg-black/30 flex items-center justify-center text-white text-xs font-mono"
                  style={{
                    width: qrPosition.size,
                    height: qrPosition.size,
                    left: qrPosition.x,
                    top: qrPosition.y,
                  }}
                  draggable
                  onDragEnd={(e) => {
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (rect) {
                      let newX = e.clientX - rect.left - qrPosition.size / 2;
                      let newY = e.clientY - rect.top - qrPosition.size / 2;
                      newX = Math.min(Math.max(0, newX), rect.width - qrPosition.size);
                      newY = Math.min(Math.max(0, newY), rect.height - qrPosition.size);
                      setQrPosition({ ...qrPosition, x: newX, y: newY });
                    }
                  }}
                >
                  QR
                </div>
              </div>
            ) : (
              <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                Upload a card to see preview
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">Drag the QR box to reposition (desktop only)</p>
          </div>
        </div>
      </div>
    </div>
  );
}