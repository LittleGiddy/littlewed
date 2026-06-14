'use client';
import { useState, useEffect } from 'react';
import { Upload, Save, Move, Maximize2, AlertCircle, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function TenantSettings() {
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [qrX, setQrX] = useState(50);
  const [qrY, setQrY] = useState(50);
  const [qrSize, setQrSize] = useState(150); // ✅ fixed
  const [simpleMode, setSimpleMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/tenant/settings')
      .then(res => res.json())
      .then(data => {
        if (data.baseCardUrl) setTemplateUrl(data.baseCardUrl);
        if (data.qrX !== undefined) setQrX(data.qrX);
        if (data.qrY !== undefined) setQrY(data.qrY);
        if (data.qrSize) setQrSize(data.qrSize);
        if (data.simpleEventMode !== undefined) setSimpleMode(data.simpleEventMode);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load settings');
        setLoading(false);
      });
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/tenant/upload-template', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) setTemplateUrl(data.url);
      else setError('Upload failed. Please try again.');
    } catch {
      setError('Upload error. Please try again.');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCardUrl: templateUrl,
          qrX,
          qrY,
          qrSize,
          simpleEventMode: simpleMode,
        }),
      });
      if (res.ok) {
        setSaved(true);
        toast.success('Settings saved!');
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError('Save failed. Please try again.');
      }
    } catch {
      setError('Save error. Please try again.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link
          href="/client/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[#0D4F4F] hover:underline mb-4"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Card Template</h1>
        <p className="text-gray-500 text-sm mt-1">Upload your design once – it will be used for all your events.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center justify-between mb-6">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={18} className="text-[#0D4F4F]" />
            <h2 className="font-semibold text-gray-800">1. Upload Card</h2>
          </div>
          {templateUrl ? (
            <div className="text-center">
              <img src={templateUrl} alt="Card template" className="max-h-48 mx-auto rounded-lg shadow-sm" />
              <button
                onClick={() => setTemplateUrl(null)}
                className="mt-3 text-sm text-red-500 hover:text-red-600"
              >
                Remove
              </button>
              <label className="inline-block mt-2 cursor-pointer text-sm text-indigo-600 hover:text-indigo-700">
                Replace image
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#0D4F4F] transition">
              <ImageIcon size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">Click to upload PNG or JPG</p>
              <p className="text-xs text-gray-400 mt-1">Recommended: 1080×1350px</p>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {uploading && <p className="text-sm text-[#0D4F4F] mt-2 animate-pulse">Uploading...</p>}
            </label>
          )}
        </div>

        {/* QR Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Move size={18} className="text-[#0D4F4F]" />
            <h2 className="font-semibold text-gray-800">2. Position QR Code</h2>
          </div>
          <div className="space-y-5">
            <div>
              <label className="flex justify-between text-sm text-gray-700 mb-1">
                Horizontal position <span className="font-mono text-[#0D4F4F]">{qrX}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={qrX}
                onChange={e => setQrX(Number(e.target.value))}
                className="w-full accent-[#0D4F4F]"
              />
            </div>
            <div>
              <label className="flex justify-between text-sm text-gray-700 mb-1">
                Vertical position <span className="font-mono text-[#0D4F4F]">{qrY}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={qrY}
                onChange={e => setQrY(Number(e.target.value))}
                className="w-full accent-[#0D4F4F]"
              />
            </div>
            <div>
              <label className="flex justify-between text-sm text-gray-700 mb-1">
                QR size <span className="font-mono text-[#0D4F4F]">{qrSize}px</span>
              </label>
              <input
                type="range"
                min="100"
                max="300"
                step="10"
                value={qrSize}
                onChange={e => setQrSize(Number(e.target.value))}
                className="w-full accent-[#0D4F4F]"
              />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Maximize2 size={18} className="text-[#0D4F4F]" />
            <h2 className="font-semibold text-gray-800">Live Preview</h2>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-gray-100 min-h-[300px] flex items-center justify-center">
            {templateUrl ? (
              <>
                <img src={templateUrl} alt="Preview" className="w-full object-contain" />
                <div
                  className="absolute border-2 border-white rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xs font-mono"
                  style={{
                    left: `${qrX}%`,
                    top: `${qrY}%`,
                    width: qrSize,
                    height: qrSize,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  QR
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p>Upload a template to preview</p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            The QR code will be placed exactly where shown above. Use the sliders to reposition.
          </p>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleSave}
          disabled={saving || !templateUrl}
          className={`px-6 py-2 rounded-lg font-semibold text-white transition-all ${
            saved
              ? 'bg-green-600'
              : 'bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] hover:shadow-md disabled:opacity-50'
          }`}
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </div>
          ) : saved ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} /> Saved!
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save size={16} /> Save Settings
            </div>
          )}
        </button>
      </div>

      {/* Simple mode toggle */}
      <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
        <div>
          <label className="font-medium text-gray-800">Quick Event Mode</label>
          <p className="text-sm text-gray-500">Create events without budget (no Stripe payment)</p>
        </div>
        <input
          type="checkbox"
          checked={simpleMode}
          onChange={e => setSimpleMode(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
        />
      </div>
    </div>
  );
}