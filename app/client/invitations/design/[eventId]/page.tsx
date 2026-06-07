'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Move, Maximize2, Loader2 } from 'lucide-react';

export default function InvitationDesigner() {
  const { eventId } = useParams();
  const router = useRouter();
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 80, y: 300, size: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing tenant settings
  useEffect(() => {
    fetch('/api/tenant/settings')
      .then(res => res.json())
      .then(data => {
        if (data.templateCardUrl) setTemplateUrl(data.templateCardUrl);
        if (data.qrPlacementX !== undefined) setQrPosition(prev => ({ ...prev, x: data.qrPlacementX, y: data.qrPlacementY }));
        if (data.qrSize) setQrPosition(prev => ({ ...prev, size: data.qrSize }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGenerating(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/tenant/upload-template', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setTemplateUrl(data.url);
        alert('Card uploaded successfully');
      } else {
        alert('Upload failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setGenerating(false);
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

  const handleSaveAndGenerate = async () => {
    // 1. Save QR placement to tenant settings
    const saveRes = await fetch('/api/tenant/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateCardUrl: templateUrl,
        qrPlacementX: qrPosition.x,
        qrPlacementY: qrPosition.y,
        qrSize: qrPosition.size,
      }),
    });
    if (!saveRes.ok) {
      alert('Failed to save settings');
      return;
    }

    // 2. Generate QR codes for all guests of this event
    setGenerating(true);
    const genRes = await fetch('/api/invitations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    const data = await genRes.json();
    if (genRes.ok) {
      alert(`Generated ${data.generated} invitation cards.`);
      router.push(`/client/invitations/send/${eventId}`);
    } else {
      alert('Generation failed: ' + data.error);
    }
    setGenerating(false);
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">Design Invitation</h1>
          <p className="text-gray-600 mt-2">Upload your card, drag the QR code to the desired position</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left column: Upload & QR Controls */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" /> 1. Upload Card Design
              </h2>
              <div
                onClick={handleUploadClick}
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
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Move className="w-5 h-5 text-indigo-600" /> 2. QR Code Settings
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QR Size (px)</label>
                <input
                  type="range"
                  min="80"
                  max="250"
                  value={qrPosition.size}
                  onChange={(e) => setQrPosition({ ...qrPosition, size: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="text-sm text-gray-500">{qrPosition.size}px</span>
              </div>
            </div>

            {templateUrl && (
              <button
                onClick={handleSaveAndGenerate}
                disabled={generating}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Generating QR Codes...
                  </>
                ) : (
                  '✨ Generate QR Codes for All Guests'
                )}
              </button>
            )}
          </div>

          {/* Right column: Live Preview with Draggable QR */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-indigo-600" /> Preview
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
                <Upload className="w-12 h-12 mb-2 opacity-50" />
                <p>Upload a card to see preview</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">Drag the QR box to reposition</p>
          </div>
        </div>
      </div>
    </div>
  );
}