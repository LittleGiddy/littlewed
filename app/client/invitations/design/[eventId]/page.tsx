'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Move, Maximize2, Save, Loader2, X } from 'lucide-react';

export default function EventInvitationDesigner() {
  const { eventId } = useParams();
  const router = useRouter();
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [qrX, setQrX] = useState(100);
  const [qrY, setQrY] = useState(100);
  const [qrSize, setQrSize] = useState(200);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing event card settings
  useEffect(() => {
    fetch(`/api/events/${eventId}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.templateCardUrl) setTemplateUrl(data.templateCardUrl);
        if (data.qrPlacementX !== undefined) setQrX(data.qrPlacementX);
        if (data.qrPlacementY !== undefined) setQrY(data.qrPlacementY);
        if (data.qrSize) setQrSize(data.qrSize);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('eventId', eventId as string);
    try {
      const res = await fetch('/api/events/upload-card', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setTemplateUrl(data.url);
        alert('Card uploaded successfully');
      } else {
        alert('Upload failed');
      }
    } catch {
      alert('Network error');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateCardUrl: templateUrl,
        qrPlacementX: qrX,
        qrPlacementY: qrY,
        qrSize: qrSize,
      }),
    });
    if (res.ok) {
      alert('Settings saved');
      router.push(`/client/invitations/send/${eventId}`);
    } else {
      alert('Save failed');
    }
    setSaving(false);
  };

  // Drag handlers for QR overlay
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - qrX * rect.width / 100,
      y: e.clientY - rect.top - qrY * rect.height / 100,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX - rect.left - dragOffset.x) / rect.width * 100;
    let newY = (e.clientY - rect.top - dragOffset.y) / rect.height * 100;
    newX = Math.min(Math.max(0, newX), 100);
    newY = Math.min(Math.max(0, newY), 100);
    setQrX(newX);
    setQrY(newY);
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">Design Invitation</h1>
          <p className="text-gray-600 mt-2">Upload your card, then drag the QR code to the desired position</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left column – Upload & QR Controls */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" /> 1. Upload Card Design
              </h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition bg-indigo-50/30"
              >
                {templateUrl ? (
                  <div>
                    <img src={templateUrl} alt="Card" className="max-h-48 mx-auto rounded-lg mb-2" />
                    <p className="text-green-600 font-medium">Card uploaded</p>
                    <button
                      className="text-sm text-indigo-600 mt-1"
                      onClick={(e) => { e.stopPropagation(); setTemplateUrl(null); }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Click to upload PNG or JPG</p>
                    <p className="text-xs text-gray-400 mt-1">Recommended: 1080x1350px</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleUpload}
                className="hidden"
              />
              {uploading && <p className="text-indigo-600 mt-2 text-center">Uploading...</p>}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Move className="w-5 h-5 text-indigo-600" /> 2. QR Code Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Horizontal position: {Math.round(qrX)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={qrX}
                    onChange={(e) => setQrX(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vertical position: {Math.round(qrY)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={qrY}
                    onChange={(e) => setQrY(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">QR size: {qrSize}px</label>
                  <input
                    type="range"
                    min="100"
                    max="300"
                    step="10"
                    value={qrSize}
                    onChange={(e) => setQrSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {templateUrl && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            )}
          </div>

          {/* Right column – Live Preview with Draggable QR */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-indigo-600" /> Live Preview
            </h2>
            {templateUrl ? (
              <div
                ref={canvasRef}
                className="relative rounded-lg overflow-hidden shadow-md"
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <img src={templateUrl} alt="Card preview" className="w-full h-auto" />
                <div
                  className="absolute border-2 border-white rounded-lg shadow-lg cursor-move bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-xs font-mono"
                  style={{
                    width: qrSize,
                    height: qrSize,
                    left: `${qrX}%`,
                    top: `${qrY}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={handleMouseDown}
                >
                  QR
                </div>
              </div>
            ) : (
              <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                <Upload className="w-12 h-12 mb-2 opacity-50" />
                <p>Upload a card to see preview</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">Drag the QR box to reposition (desktop only)</p>
          </div>
        </div>
      </div>
    </div>
  );
}