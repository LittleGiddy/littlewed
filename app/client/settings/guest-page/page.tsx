'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Loader2, Upload, Eye, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import ModernColorPicker from '@/app/components/ModernColorPicker';
import { GUEST_PAGE_FONTS, FONT_STACKS, fontStack } from '@/lib/fonts';

const FONTS = GUEST_PAGE_FONTS;

interface Draft {
  guestPagePrimaryColor: string;
  guestPageSecondaryColor: string;
  guestPageAccentColor: string;
  guestPageFontFamily: string;
  guestPageHeaderImage: string;
  guestPageTitle: string;
  guestPageSubtitle: string;
  guestPageDetailsTitle: string;
  guestPageRsvpTitle: string;
  guestPageFooterNote: string;
}

const DEFAULTS: Draft = {
  guestPagePrimaryColor: '#BE185D',
  guestPageSecondaryColor: '#6D28D9',
  guestPageAccentColor: '#F6C445',
  guestPageFontFamily: 'Playfair Display',
  guestPageHeaderImage: '',
  guestPageTitle: '',
  guestPageSubtitle: '',
  guestPageDetailsTitle: 'The Invitation',
  guestPageRsvpTitle: 'Will You Attend?',
  guestPageFooterNote: 'With love',
};

function readDraft(): Draft {
  try {
    const saved = localStorage.getItem('guest_page_theme');
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export default function GuestPageSettings() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load current settings ─────────────────────────────────────────
  useEffect(() => {
    const local = readDraft();
    fetch('/api/tenant/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setDraft({
          guestPagePrimaryColor: data.guestPagePrimaryColor || local.guestPagePrimaryColor,
          guestPageSecondaryColor: data.guestPageSecondaryColor || local.guestPageSecondaryColor,
          guestPageAccentColor: data.guestPageAccentColor || local.guestPageAccentColor,
          guestPageFontFamily: data.guestPageFontFamily || local.guestPageFontFamily,
          guestPageHeaderImage: data.guestPageHeaderImage || local.guestPageHeaderImage,
          guestPageTitle: data.guestPageTitle || local.guestPageTitle,
          guestPageSubtitle: data.guestPageSubtitle || local.guestPageSubtitle,
          guestPageDetailsTitle: data.guestPageDetailsTitle || local.guestPageDetailsTitle,
          guestPageRsvpTitle: data.guestPageRsvpTitle || local.guestPageRsvpTitle,
          guestPageFooterNote: data.guestPageFooterNote || local.guestPageFooterNote,
        });
      })
      .catch(() => setDraft(local))
      .finally(() => setLoading(false));
  }, []);

  // ─── Auto-save draft ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try { localStorage.setItem('guest_page_theme', JSON.stringify(draft)); } catch { /* */ }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, loading]);

  const set = (key: keyof Draft, value: string) => setDraft(d => ({ ...d, [key]: value }));

  const fontClass = fontStack(draft.guestPageFontFamily);

  // ─── Preview initials ──────────────────────────────────────────────
  const previewInitials = (draft.guestPageTitle || 'J & J Night').replace(/\s*Night$/i, '');

  // ─── Save settings ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Guest page theme saved');
        try { localStorage.removeItem('guest_page_theme'); } catch { /* */ }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Header image upload ───────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/tenant/upload-guest-page-header', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.url) {
        set('guestPageHeaderImage', data.url);
        toast.success('Header image uploaded');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          href="/client/settings"
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:text-[#0D4B4B] hover:border-[#0D4B4B] transition"
        >
          <ArrowLeft size={17} />
        </Link>
        <div>
          <p className="text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">Appearance</p>
          <h1 className="font-serif text-3xl font-black text-gray-900 leading-tight">Guest Page Theme</h1>
          <p className="text-sm text-gray-400 mt-1">Customize what guests see when they open their invitation link.</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* ─── Colors ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Colors</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 m-0">Primary Color</p>
                  <p className="text-[11px] text-gray-400 m-0 mt-0.5">Hero gradient, headings</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner" style={{ backgroundColor: draft.guestPagePrimaryColor }} />
                  <ModernColorPicker
                    value={draft.guestPagePrimaryColor}
                    onChange={(c: string) => set('guestPagePrimaryColor', c)}
                    className="w-36"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 m-0">Secondary Color</p>
                  <p className="text-[11px] text-gray-400 m-0 mt-0.5">Gradient end, accents</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner" style={{ backgroundColor: draft.guestPageSecondaryColor }} />
                  <ModernColorPicker
                    value={draft.guestPageSecondaryColor}
                    onChange={(c: string) => set('guestPageSecondaryColor', c)}
                    className="w-36"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 m-0">Accent Color</p>
                  <p className="text-[11px] text-gray-400 m-0 mt-0.5">Gold details, dividers</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner" style={{ backgroundColor: draft.guestPageAccentColor }} />
                  <ModernColorPicker
                    value={draft.guestPageAccentColor}
                    onChange={(c: string) => set('guestPageAccentColor', c)}
                    className="w-36"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Font ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Title Font</h2>
            <select
              value={draft.guestPageFontFamily}
              onChange={e => set('guestPageFontFamily', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
            >
              {FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>{f}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1.5" style={{ fontFamily: fontClass }}>
              Preview: J & J Night
            </p>
          </div>
        </div>

        {/* ─── Header Image ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Hero Background Image</h2>
            <p className="text-xs text-gray-400 mb-3">Optional. Adds a photo behind the gradient overlay.</p>

            {draft.guestPageHeaderImage && (
              <div className="mb-3 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.guestPageHeaderImage}
                  alt="Header background"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => set('guestPageHeaderImage', '')}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-600 transition"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-[#0D4B4B]/40 hover:bg-[#0D4B4B]/[0.03] transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? 'Uploading...' : 'Upload background'}
            </button>
          </div>
        </div>

        {/* ─── Custom Text ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Custom Text</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-800">Hero Title</label>
                <p className="text-[11px] text-gray-400 m-0 mb-1.5">
                  Leave blank to auto-generate &quot;A &amp; B Night&quot; from the couple&apos;s initials.
                </p>
                <input
                  value={draft.guestPageTitle}
                  onChange={e => set('guestPageTitle', e.target.value)}
                  placeholder="e.g. J & J Night"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">Subtitle</label>
                <p className="text-[11px] text-gray-400 m-0 mb-1.5">
                  Shown below the title. Leave blank for default: &quot;You are cordially invited&quot;.
                </p>
                <input
                  value={draft.guestPageSubtitle}
                  onChange={e => set('guestPageSubtitle', e.target.value)}
                  placeholder="e.g. Together with their families"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">Details Section Title</label>
                <p className="text-[11px] text-gray-400 m-0 mb-1.5">
                  Heading for the event details section. Leave blank for default: &quot;The Invitation&quot;.
                </p>
                <input
                  value={draft.guestPageDetailsTitle}
                  onChange={e => set('guestPageDetailsTitle', e.target.value)}
                  placeholder="e.g. The Invitation"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">RSVP Section Title</label>
                <p className="text-[11px] text-gray-400 m-0 mb-1.5">
                  Heading above the RSVP buttons. Leave blank for default: &quot;Will You Attend?&quot;.
                </p>
                <input
                  value={draft.guestPageRsvpTitle}
                  onChange={e => set('guestPageRsvpTitle', e.target.value)}
                  placeholder="e.g. Will You Attend?"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">Footer Note</label>
                <p className="text-[11px] text-gray-400 m-0 mb-1.5">
                  The closing line at the bottom of the page. Leave blank for default: &quot;With love&quot;.
                </p>
                <input
                  value={draft.guestPageFooterNote}
                  onChange={e => set('guestPageFooterNote', e.target.value)}
                  placeholder="e.g. With love"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Live Mini Preview ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-extrabold text-gray-800 m-0">Preview</h2>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4B4B] bg-[#0D4B4B]/[0.06] px-3 py-1.5 rounded-lg hover:bg-[#0D4B4B]/[0.1] transition"
              >
                <Eye size={13} />
                {showPreview ? 'Hide' : 'Show'} full page
              </button>
            </div>

            {/* Hero mini preview */}
            <div
              className="rounded-2xl overflow-hidden text-center py-10 px-6 relative"
              style={{
                background: draft.guestPageHeaderImage
                  ? `url(${draft.guestPageHeaderImage}) center/cover, linear-gradient(135deg, ${draft.guestPagePrimaryColor}, ${draft.guestPageSecondaryColor})`
                  : `linear-gradient(135deg, ${draft.guestPagePrimaryColor}, ${draft.guestPageSecondaryColor})`,
              }}
            >
              {/* Dark overlay for image */}
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative z-10">
                {/* Decorative top flourish */}
                <div className="text-2xl mb-2 opacity-60" style={{ color: draft.guestPageAccentColor }}>&#10053;</div>
                <p
                  className="text-[11px] uppercase tracking-[3px] font-semibold mb-3"
                  style={{ color: draft.guestPageAccentColor }}
                >
                  {draft.guestPageSubtitle || 'You are cordially invited'}
                </p>
                <h3
                  className="text-4xl font-black mb-1 leading-tight"
                  style={{
                    fontFamily: fontClass,
                    color: '#fff',
                    textShadow: '0 2px 20px rgba(0,0,0,0.25)',
                  }}
                >
                  {draft.guestPageTitle || previewInitials + ' Night'}
                </h3>
                {/* Gold decorative divider */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="h-px w-10" style={{ backgroundColor: draft.guestPageAccentColor, opacity: 0.6 }} />
                  <span className="text-sm" style={{ color: draft.guestPageAccentColor }}>&#9830;</span>
                  <span className="h-px w-10" style={{ backgroundColor: draft.guestPageAccentColor, opacity: 0.6 }} />
                </div>
              </div>
            </div>

            {showPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="rounded-xl border border-gray-100 p-5 bg-gray-50/50 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPagePrimaryColor + '18', color: draft.guestPagePrimaryColor }}>📅</span>
                    <span>Saturday, 3rd September 2026</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPageSecondaryColor + '18', color: draft.guestPageSecondaryColor }}>🕐</span>
                    <span>Saa 12:00 Jioni</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPageAccentColor + '18', color: draft.guestPageAccentColor }}>📍</span>
                    <span>Galilaya Hall, Ubungo</span>
                  </div>
                  <div
                    className="mt-2 h-40 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 text-xs font-medium"
                  >
                    Guest&apos;s invitation card
                  </div>
                  <div className="pt-1">
                    <p className="font-semibold text-gray-700" style={{ fontFamily: fontClass, fontSize: '1.05rem' }}>
                      {draft.guestPageDetailsTitle || 'The Invitation'}
                    </p>
                    <p className="text-xs text-gray-400 -mt-0.5">We would be honored to have you join us</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                    <p className="font-semibold text-gray-700" style={{ fontFamily: fontClass }}>
                      {draft.guestPageRsvpTitle || 'Will You Attend?'}
                    </p>
                    <p className="text-[11px] text-gray-400">Kindly RSVP so we can plan for you</p>
                    <div className="flex justify-center gap-2 mt-2">
                      <span className="bg-green-600 text-white text-[10px] px-2.5 py-1 rounded-full">Yes I&apos;ll attend</span>
                      <span className="bg-red-600 text-white text-[10px] px-2.5 py-1 rounded-full">Sadly, no</span>
                      <span className="bg-gray-600 text-white text-[10px] px-2.5 py-1 rounded-full">Maybe</span>
                    </div>
                  </div>
                  <p className="text-center text-[10px] uppercase tracking-[3px] text-gray-400 font-semibold">
                    &#10053; {draft.guestPageFooterNote || 'With love'} &#10053;
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ─── Save ──────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-3 rounded-2xl font-semibold text-sm shadow-md shadow-[#0D4B4B]/25 hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving...</>
          ) : (
            <><Save size={16} /> Save Guest Page Theme</>
          )}
        </button>
      </div>
    </div>
  );
}
