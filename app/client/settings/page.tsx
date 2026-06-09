'use client';
import { useState, useEffect } from 'react';
import { Upload, Save, Move, Maximize2, AlertCircle, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function TenantSettings() {
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [qrX, setQrX] = useState(50);
  const [qrY, setQrY] = useState(50);
  const [qrSize, setQrSize] = useState(150);
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
      <div style={{
        minHeight: '100vh', background: '#F0F4F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, border: '3px solid #E2EAF0',
            borderTopColor: '#0D4F4F', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ color: '#9BAAB8', fontSize: 14, fontWeight: 500 }}>Loading settings…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .page-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
        }
        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 6px;
        }
        .page-title span { color: #E8A598; }
        .page-sub { color: #7A8FA6; font-size: 14px; font-weight: 400; }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 28px;
        }

        .card {
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
          transition: box-shadow 0.2s;
        }
        .card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.09); }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .card:nth-child(1) { animation-delay: 0.05s; }
        .card:nth-child(2) { animation-delay: 0.1s; }
        .card:nth-child(3) { animation-delay: 0.15s; }

        .card-header {
          display: flex; align-items: center; gap: 12px;
          padding: 18px 22px; border-bottom: 1.5px solid #F0F4F8;
        }

        .card-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
          flex-shrink: 0;
        }

        .card-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B;
        }

        .card-step {
          margin-left: auto;
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 10px; border-radius: 20px;
        }

        .card-body { padding: 22px; }

        .upload-zone {
          border: 2px dashed #E2EAF0; border-radius: 14px;
          padding: 32px 20px; text-align: center; cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
        }
        .upload-zone:hover { border-color: #0D4F4F; background: rgba(13,79,79,0.02); }

        .upload-icon-wrap {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px; color: #0D4F4F;
          transition: transform 0.2s;
        }
        .upload-zone:hover .upload-icon-wrap { transform: scale(1.08); }

        .upload-label {
          font-size: 13.5px; font-weight: 700; color: #0D1B1B; margin-bottom: 4px;
        }
        .upload-hint { font-size: 12px; color: #9BAAB8; font-weight: 400; }

        .upload-pulse {
          font-size: 13px; font-weight: 600; color: #0D4F4F;
          margin-top: 10px; animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .preview-img-wrap {
          position: relative; display: inline-block;
        }
        .preview-img {
          max-height: 200px; border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .remove-btn {
          position: absolute; top: -8px; right: -8px;
          width: 24px; height: 24px; border-radius: 50%;
          background: #E05C5C; border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: white; transition: background 0.15s;
        }
        .remove-btn:hover { background: #C0392B; }

        .slider-row { margin-bottom: 22px; }
        .slider-row:last-child { margin-bottom: 0; }

        .slider-top {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px;
        }

        .slider-label { font-size: 13px; font-weight: 600; color: #4A6072; }

        .slider-value {
          font-size: 12px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); padding: 2px 10px;
          border-radius: 20px; font-family: monospace;
        }

        .slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 3px;
          background: #E2EAF0; outline: none; cursor: pointer;
          transition: background 0.2s;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          cursor: pointer; border: 2px solid white;
          box-shadow: 0 2px 8px rgba(13,79,79,0.4);
          transition: transform 0.15s;
        }
        .slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .slider::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          cursor: pointer; border: 2px solid white;
        }

        .preview-card {
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          display: flex; flex-direction: column;
          animation: cardPop 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both;
          transition: box-shadow 0.2s;
          grid-row: span 2;
        }
        .preview-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.09); }

        .preview-body {
          padding: 22px; flex: 1;
          display: flex; flex-direction: column;
        }

        .preview-canvas {
          flex: 1; min-height: 300px;
          border-radius: 14px; overflow: hidden;
          background: #F0F4F8; position: relative;
          display: flex; align-items: center; justify-content: center;
        }

        .preview-canvas img { width: 100%; display: block; }

        .qr-overlay {
          position: absolute;
          background: rgba(13,79,79,0.75);
          border: 2px solid white;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 11px; font-weight: 800;
          letter-spacing: 1px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          backdrop-filter: blur(2px);
          transition: left 0.2s, top 0.2s, width 0.2s, height 0.2s;
        }

        .preview-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: #C8D4DE; gap: 10px; min-height: 300px;
        }

        .preview-empty-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: #F0F4F8; display: flex;
          align-items: center; justify-content: center;
        }

        .preview-caption {
          font-size: 11.5px; color: #9BAAB8; text-align: center;
          margin-top: 12px; line-height: 1.5;
        }

        .err-banner {
          background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B;
          padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600;
          margin-bottom: 20px; display: flex; gap: 8px; align-items: center;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-5px); }
          60%      { transform: translateX(5px); }
        }

        .save-bar {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: white; border-top: 1.5px solid #F0F4F8;
          padding: 14px 24px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; z-index: 50;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.06);
          animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        .save-hint { font-size: 13px; color: #9BAAB8; font-weight: 500; }
        .save-hint strong { color: #0D4F4F; }

        .save-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 13px 28px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          position: relative; overflow: hidden;
        }
        .save-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .save-btn:hover:not(:disabled)::after { opacity: 1; }
        .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .save-btn:active:not(:disabled) { transform: translateY(0); }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .save-btn-success {
          background: linear-gradient(135deg, #1A7A4A, #155C38) !important;
        }

        .spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px solid #F0F4F8;
        }

        .checkbox-label {
          font-size: 13px;
          font-weight: 600;
          color: #4A6072;
        }

        .checkbox-desc {
          font-size: 11.5px;
          color: #9BAAB8;
          margin-left: auto;
        }

        @media (max-width: 768px) {
          .page-title { font-size: 26px; }
          .grid-2 { grid-template-columns: 1fr; }
          .preview-card { grid-row: span 1; }
          .save-bar { padding: 12px 16px; }
        }
      `}</style>

      {/* ✅ Removed .wrap div wrapper */}
      <div>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/client/dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 700, color: '#0D4F4F',
              textDecoration: 'none', marginBottom: 16,
              padding: '7px 14px',
              background: 'rgba(13,79,79,0.08)',
              border: '1px solid rgba(13,79,79,0.12)',
              borderRadius: 10,
              transition: 'background 0.15s, transform 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(13,79,79,0.14)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(13,79,79,0.08)')}
          >
            ← Back Home
          </Link>
          <div className="page-eyebrow">Settings</div>
          <div className="page-title">Card <span>Template</span></div>
          <p className="page-sub">Upload your design once — it will be used for all your events.</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="err-banner">
            <AlertCircle size={16} />{error}
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="grid-2">

          {/* Upload card */}
          <div className="card">
            <div className="card-header">
              <div className="card-icon"><Upload size={16} /></div>
              <div className="card-title">Upload your card</div>
              <div className="card-step">Step 1</div>
            </div>
            <div className="card-body">
              {templateUrl ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="preview-img-wrap">
                    <img src={templateUrl} alt="Template" className="preview-img" />
                    <button className="remove-btn" onClick={() => setTemplateUrl(null)}>
                      <X size={12} />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: '#9BAAB8', marginTop: 12, fontWeight: 500 }}>
                    Template uploaded ✓ — upload a new one to replace
                  </p>
                  <label htmlFor="template-upload" style={{ cursor: 'pointer' }}>
                    <div style={{
                      marginTop: 12, padding: '9px 16px', border: '1.5px solid #E2EAF0',
                      borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4A6072',
                      display: 'inline-block', transition: 'border-color 0.15s',
                    }}>
                      Replace image
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload}
                      style={{ display: 'none' }} id="template-upload" disabled={uploading} />
                  </label>
                </div>
              ) : (
                <>
                  <input type="file" accept="image/*" onChange={handleImageUpload}
                    style={{ display: 'none' }} id="template-upload" disabled={uploading} />
                  <label htmlFor="template-upload">
                    <div className="upload-zone">
                      <div className="upload-icon-wrap">
                        <ImageIcon size={22} />
                      </div>
                      <div className="upload-label">Click to upload PNG or JPG</div>
                      <div className="upload-hint">Recommended: 1080 × 1350px</div>
                      {uploading && <div className="upload-pulse">Uploading…</div>}
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* QR controls */}
          <div className="card">
            <div className="card-header">
              <div className="card-icon"><Move size={16} /></div>
              <div className="card-title">Position the QR code</div>
              <div className="card-step">Step 2</div>
            </div>
            <div className="card-body">
              <div className="slider-row">
                <div className="slider-top">
                  <span className="slider-label">Horizontal position</span>
                  <span className="slider-value">{qrX}%</span>
                </div>
                <input type="range" min="0" max="100" value={qrX}
                  onChange={e => setQrX(Number(e.target.value))} className="slider" />
              </div>

              <div className="slider-row">
                <div className="slider-top">
                  <span className="slider-label">Vertical position</span>
                  <span className="slider-value">{qrY}%</span>
                </div>
                <input type="range" min="0" max="100" value={qrY}
                  onChange={e => setQrY(Number(e.target.value))} className="slider" />
              </div>

              <div className="slider-row">
                <div className="slider-top">
                  <span className="slider-label">QR size</span>
                  <span className="slider-value">{qrSize}px</span>
                </div>
                <input type="range" min="100" max="300" step="10" value={qrSize}
                  onChange={e => setQrSize(Number(e.target.value))} className="slider" />
              </div>

              {/* Simple event mode toggle */}
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="simpleEventMode"
                  checked={simpleMode}
                  onChange={e => setSimpleMode(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="simpleEventMode" className="checkbox-label">
                  Quick Event Mode
                </label>
                <span className="checkbox-desc">
                  Create events without budget (no Stripe payment)
                </span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="preview-card">
            <div className="card-header">
              <div className="card-icon"><Maximize2 size={16} /></div>
              <div className="card-title">Live Preview</div>
            </div>
            <div className="preview-body">
              <div className="preview-canvas">
                {templateUrl ? (
                  <>
                    <img src={templateUrl} alt="Preview" />
                    <div
                      className="qr-overlay"
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
                  <div className="preview-empty">
                    <div className="preview-empty-icon">
                      <ImageIcon size={22} color="#C8D4DE" />
                    </div>
                    <p style={{ fontSize: 13, color: '#9BAAB8', fontWeight: 500 }}>
                      Upload a template to preview
                    </p>
                  </div>
                )}
              </div>
              <p className="preview-caption">
                The QR code will be placed exactly where shown above.<br />
                Drag the sliders to reposition.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky save bar */}
      <div className="save-bar">
        <p className="save-hint">
          {saved
            ? <><strong>✓ Saved!</strong> Your template settings are live.</>
            : templateUrl
              ? <>Ready to save — <strong>QR at {qrX}%, {qrY}%</strong>, size {qrSize}px</>
              : 'Upload a template card to enable saving.'
          }
        </p>
        <button
          className={`save-btn${saved ? ' save-btn-success' : ''}`}
          onClick={handleSave}
          disabled={saving || !templateUrl}
        >
          {saving ? (
            <><div className="spinner" /> Saving…</>
          ) : saved ? (
            <><CheckCircle size={15} /> Saved!</>
          ) : (
            <><Save size={15} /> Save Settings</>
          )}
        </button>
      </div>
    </div>
  );
}
