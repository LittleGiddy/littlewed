'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Move, Maximize2, Save, Loader2, X, Type } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvitationDesigner() {
  const { eventId } = useParams();
  const router = useRouter();
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [qrX, setQrX] = useState(100);
  const [qrY, setQrY] = useState(100);
  const [qrSize, setQrSize] = useState(200);
  const [qrColor, setQrColor] = useState('#000000');
  const [nameX, setNameX] = useState(50);
  const [nameY, setNameY] = useState(50);
  const [nameFontSize, setNameFontSize] = useState(24);
  const [nameFontColor, setNameFontColor] = useState('#000000');
  const [includeName, setIncludeName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [isDraggingName, setIsDraggingName] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.templateCardUrl) setTemplateUrl(data.templateCardUrl);
        setQrX(data.qrPlacementX ?? 100);
        setQrY(data.qrPlacementY ?? 100);
        setQrSize(data.qrSize ?? 200);
        setQrColor(data.qrColor ?? '#000000');
        setNameX(data.namePlacementX ?? 50);
        setNameY(data.namePlacementY ?? 50);
        setNameFontSize(data.nameFontSize ?? 24);
        setNameFontColor(data.nameFontColor ?? '#000000');
        setIncludeName(data.includeName ?? false);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load settings');
        setLoading(false);
      });
  }, [eventId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('eventId', eventId as string);
    try {
      const res = await fetch('/api/events/upload-card', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) setTemplateUrl(data.url);
      else toast.error('Upload failed');
    } catch {
      toast.error('Network error');
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
        qrSize,
        qrColor,
        includeName,
        namePlacementX: nameX,
        namePlacementY: nameY,
        nameFontSize,
        nameFontColor,
      }),
    });
    if (res.ok) {
      toast.success('Settings saved');
      router.push(`/client/invitations/send/${eventId}`);
    } else {
      toast.error('Save failed');
    }
    setSaving(false);
  };

  const handleQRMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    setIsDraggingQR(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - (qrX / 100) * rect.width,
      y: e.clientY - rect.top - (qrY / 100) * rect.height,
    });
  };

  const handleQRMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingQR || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX - rect.left - dragOffset.x) / rect.width * 100;
    let newY = (e.clientY - rect.top - dragOffset.y) / rect.height * 100;
    newX = Math.min(Math.max(0, newX), 100);
    newY = Math.min(Math.max(0, newY), 100);
    setQrX(newX);
    setQrY(newY);
  };

  const handleNameMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    setIsDraggingName(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - (nameX / 100) * rect.width,
      y: e.clientY - rect.top - (nameY / 100) * rect.height,
    });
  };

  const handleNameMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingName || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX - rect.left - dragOffset.x) / rect.width * 100;
    let newY = (e.clientY - rect.top - dragOffset.y) / rect.height * 100;
    newX = Math.min(Math.max(0, newX), 100);
    newY = Math.min(Math.max(0, newY), 100);
    setNameX(newX);
    setNameY(newY);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Design Invitation Card</h1>
      <p className="text-gray-500 mb-6">Upload your card, then drag the QR code and name text to desired positions.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column – Upload & Controls */}
        <div className="space-y-6">
          {/* Upload card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Upload size={18} className="text-[#0D4F4F]" /> 1. Upload Card</h2>
            {templateUrl ? (
              <div className="text-center">
                <img src={templateUrl} alt="Card" className="max-h-48 mx-auto rounded-lg shadow-sm" />
                <button onClick={() => setTemplateUrl(null)} className="mt-2 text-sm text-red-500">Remove</button>
                <label className="inline-block ml-3 text-sm text-indigo-600 cursor-pointer">Replace<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></label>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#0D4F4F] transition">
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <p>Click to upload PNG or JPG</p>
                <p className="text-xs text-gray-400">Recommended: 1080×1350px</p>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {uploading && <p className="text-sm text-[#0D4F4F] mt-2 animate-pulse">Uploading...</p>}
              </label>
            )}
          </div>

          {/* QR Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Move size={18} className="text-[#0D4F4F]" /> 2. QR Code</h2>
            <div className="space-y-4">
              <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(qrX)}%</span></label><input type="range" min="0" max="100" value={qrX} onChange={e => setQrX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
              <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(qrY)}%</span></label><input type="range" min="0" max="100" value={qrY} onChange={e => setQrY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
              <div><label className="flex justify-between text-sm">Size <span>{qrSize}px</span></label><input type="range" min="100" max="300" step="10" value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
              <div><label className="flex justify-between text-sm">QR Color</label><input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)} className="w-full h-10 border rounded" /></div>
            </div>
          </div>

          {/* Name Text Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><Type size={18} className="text-[#0D4F4F]" /> 3. Guest Name</h2>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeName} onChange={e => setIncludeName(e.target.checked)} /> Show name</label>
            </div>
            {includeName && (
              <div className="space-y-4">
                <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(nameX)}%</span></label><input type="range" min="0" max="100" value={nameX} onChange={e => setNameX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
                <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(nameY)}%</span></label><input type="range" min="0" max="100" value={nameY} onChange={e => setNameY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
                <div><label className="flex justify-between text-sm">Font size <span>{nameFontSize}px</span></label><input type="range" min="12" max="48" value={nameFontSize} onChange={e => setNameFontSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
                <div><label className="flex justify-between text-sm">Font color <span className="w-6 h-6 rounded border inline-block" style={{ backgroundColor: nameFontColor }}></span></label><input type="color" value={nameFontColor} onChange={e => setNameFontColor(e.target.value)} className="w-full" /></div>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !templateUrl} className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>

        {/* Right column – Live Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Maximize2 size={18} className="text-[#0D4F4F]" /> Live Preview</h2>
          <div
            ref={canvasRef}
            className="relative rounded-lg overflow-hidden bg-gray-100 min-h-[400px] flex items-center justify-center"
            onMouseMove={(e) => { handleQRMouseMove(e); handleNameMouseMove(e); }}
            onMouseUp={() => { setIsDraggingQR(false); setIsDraggingName(false); }}
            onMouseLeave={() => { setIsDraggingQR(false); setIsDraggingName(false); }}
          >
            {templateUrl ? (
              <>
                <img src={templateUrl} alt="Preview" className="w-full object-contain" />
                <div
                  className="absolute border-2 border-white rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xs font-mono cursor-move"
                  style={{
                    left: `${qrX}%`,
                    top: `${qrY}%`,
                    width: qrSize,
                    height: qrSize,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={handleQRMouseDown}
                >
                  QR
                </div>
                {includeName && (
                  <div
                    className="absolute border border-dashed border-white bg-black/30 text-white text-xs px-1 rounded cursor-move whitespace-nowrap"
                    style={{
                      left: `${nameX}%`,
                      top: `${nameY}%`,
                      fontSize: `${nameFontSize}px`,
                      color: nameFontColor,
                      transform: 'translate(-50%, -50%)',
                      fontFamily: 'Arial, sans-serif',
                    }}
                    onMouseDown={handleNameMouseDown}
                  >
                    Guest Name
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400">Upload a card to see preview</div>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">Drag the QR box and name label to reposition.</p>
        </div>
      </div>
    </div>
  );
}