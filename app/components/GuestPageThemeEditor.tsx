'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Loader2, Upload, Eye, RotateCcw, HeartHandshake, Image as ImageIcon, Plus, X, Palette as PaletteIcon, Phone, MicVocal, MapPin } from 'lucide-react';
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
  guestPageThemeColor: string;
  guestPageFontFamily: string;
  guestPageHeaderImage: string;
  guestPageCoupleImage: string;
  guestPageTitle: string;
  guestPageSubtitle: string;
  guestPageDetailsTitle: string;
  guestPageRsvpTitle: string;
  guestPageFooterNote: string;
  weddingTheme: string;
  themeColors: string[];
  contactPerson: string;
  contactPersonPhone: string;
  masterOfCeremony: string;
  mapUrl: string;
  guestPageCoverHint: string;
  guestPageCoverSubtitle: string;
  guestPageGreetingText: string;
  guestPageThemeLabel: string;
  guestPageInvitationCardLabel: string;
  guestPageReceptionLabel: string;
  guestPageContactLabel: string;
  guestPageMocLabel: string;
  guestPageMapLabel: string;
  guestPageWishesTitle: string;
  guestPageWishesHint: string;
  guestPageDateLabel: string;
  guestPageTimeLabel: string;
  guestPageVenueLabel: string;
  guestPageRsvpHint: string;
}

const DEFAULTS: Draft = {
  guestPagePrimaryColor: '#BE185D',
  guestPageSecondaryColor: '#6D28D9',
  guestPageAccentColor: '#F6C445',
  guestPageThemeColor: '#E8C46B',
  guestPageFontFamily: 'Playfair Display',
  guestPageHeaderImage: '',
  guestPageCoupleImage: '',
  guestPageTitle: '',
  guestPageSubtitle: '',
  guestPageDetailsTitle: 'The Invitation',
  guestPageRsvpTitle: 'Will You Attend?',
  guestPageFooterNote: 'With love',
  weddingTheme: '',
  themeColors: [],
  contactPerson: '',
  contactPersonPhone: '',
  masterOfCeremony: '',
  mapUrl: '',
  guestPageCoverHint: 'Tap anywhere to open',
  guestPageCoverSubtitle: 'your invitation awaits',
  guestPageGreetingText: 'we would be honored to have you join us',
  guestPageThemeLabel: 'Wedding \u00b7 Ceremony Theme',
  guestPageInvitationCardLabel: 'Your invitation card',
  guestPageReceptionLabel: 'Reception Notes',
  guestPageContactLabel: 'Contact Person',
  guestPageMocLabel: 'Master of Ceremony',
  guestPageMapLabel: 'Find the Venue',
  guestPageWishesTitle: 'Wedding Wishes',
  guestPageWishesHint: 'Leave a little love for the couple',
  guestPageDateLabel: 'Date',
  guestPageTimeLabel: 'Time',
  guestPageVenueLabel: 'Venue',
  guestPageRsvpHint: 'Kindly RSVP so we can plan for you',
};

type ColorKey = 'guestPagePrimaryColor' | 'guestPageSecondaryColor' | 'guestPageAccentColor' | 'guestPageThemeColor';

const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'guestPagePrimaryColor', label: 'Primary Color', hint: 'Hero gradient, headings' },
  { key: 'guestPageSecondaryColor', label: 'Secondary Color', hint: 'Gradient end, accents' },
  { key: 'guestPageAccentColor', label: 'Accent Color', hint: 'Gold details, dividers' },
  { key: 'guestPageThemeColor', label: 'Wedding Theme Color', hint: 'Your wedding theme shade, button glow' },
];

interface Props {
  apiUrl: string;
  uploadUrl: string;
  backHref: string;
  title: string;
  description: string;
  draftKey: string;
  embedded?: boolean;
  enableEventSelect?: boolean;
}

interface EventOption {
  id: string;
  name: string;
  date: string;
}

export default function GuestPageThemeEditor({
  apiUrl,
  uploadUrl,
  backHref,
  title,
  description,
  draftKey,
  embedded,
  enableEventSelect,
}: Props) {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'header' | 'couple' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('__tenant__');
  const headerInputRef = useRef<HTMLInputElement>(null);
  const coupleInputRef = useRef<HTMLInputElement>(null);

  const activeApiUrl = selectedEventId === '__tenant__' ? apiUrl : `/api/events/${selectedEventId}/guest-page`;
  const activeUploadUrl = selectedEventId === '__tenant__' ? uploadUrl : `/api/events/${selectedEventId}/guest-page/upload`;
  const activeDraftKey = selectedEventId === '__tenant__' ? draftKey : `${draftKey}_event_${selectedEventId}`;

  const readDraft = (key: string): Draft => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  };

  // ─── Load tenant events list for the event selector ───────────────
  useEffect(() => {
    if (!enableEventSelect) return;
    fetch('/api/events', { credentials: 'include' })
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          setEvents(
            list.map((e: { id: string; name: string; date: string }) => ({
              id: e.id,
              name: e.name,
              date: e.date,
            }))
          );
        }
      })
      .catch(() => { /* ignore */ });
  }, [enableEventSelect]);

  // ─── Load current settings (tenant default or selected event) ────
  useEffect(() => {
    const local = readDraft(activeDraftKey);
    fetch(activeApiUrl, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const asColors = (v: unknown): string[] =>
          Array.isArray(v)
            ? (v as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim() !== '').slice(0, 6)
            : [];
        setDraft({
          guestPagePrimaryColor: data.guestPagePrimaryColor || local.guestPagePrimaryColor,
          guestPageSecondaryColor: data.guestPageSecondaryColor || local.guestPageSecondaryColor,
          guestPageAccentColor: data.guestPageAccentColor || local.guestPageAccentColor,
          guestPageThemeColor: data.guestPageThemeColor || local.guestPageThemeColor,
          guestPageFontFamily: data.guestPageFontFamily || local.guestPageFontFamily,
          guestPageHeaderImage: data.guestPageHeaderImage || local.guestPageHeaderImage,
          guestPageCoupleImage: data.guestPageCoupleImage || local.guestPageCoupleImage,
          guestPageTitle: data.guestPageTitle || local.guestPageTitle,
          guestPageSubtitle: data.guestPageSubtitle || local.guestPageSubtitle,
          guestPageDetailsTitle: data.guestPageDetailsTitle || local.guestPageDetailsTitle,
          guestPageRsvpTitle: data.guestPageRsvpTitle || local.guestPageRsvpTitle,
          guestPageFooterNote: data.guestPageFooterNote || local.guestPageFooterNote,
          weddingTheme: data.weddingTheme || local.weddingTheme || '',
          themeColors: asColors(data.themeColors).length > 0 ? asColors(data.themeColors) : local.themeColors,
          contactPerson: data.contactPerson || local.contactPerson || '',
          contactPersonPhone: data.contactPersonPhone || local.contactPersonPhone || '',
          masterOfCeremony: data.masterOfCeremony || local.masterOfCeremony || '',
          mapUrl: data.mapUrl || local.mapUrl || '',
          guestPageCoverHint: data.guestPageCoverHint || local.guestPageCoverHint || 'Tap anywhere to open',
          guestPageCoverSubtitle: data.guestPageCoverSubtitle || local.guestPageCoverSubtitle || 'your invitation awaits',
          guestPageGreetingText: data.guestPageGreetingText || local.guestPageGreetingText || 'we would be honored to have you join us',
          guestPageThemeLabel: data.guestPageThemeLabel || local.guestPageThemeLabel || 'Wedding \u00b7 Ceremony Theme',
          guestPageInvitationCardLabel: data.guestPageInvitationCardLabel || local.guestPageInvitationCardLabel || 'Your invitation card',
          guestPageReceptionLabel: data.guestPageReceptionLabel || local.guestPageReceptionLabel || 'Reception Notes',
          guestPageContactLabel: data.guestPageContactLabel || local.guestPageContactLabel || 'Contact Person',
          guestPageMocLabel: data.guestPageMocLabel || local.guestPageMocLabel || 'Master of Ceremony',
          guestPageMapLabel: data.guestPageMapLabel || local.guestPageMapLabel || 'Find the Venue',
          guestPageWishesTitle: data.guestPageWishesTitle || local.guestPageWishesTitle || 'Wedding Wishes',
          guestPageWishesHint: data.guestPageWishesHint || local.guestPageWishesHint || 'Leave a little love for the couple',
          guestPageDateLabel: data.guestPageDateLabel || local.guestPageDateLabel || 'Date',
          guestPageTimeLabel: data.guestPageTimeLabel || local.guestPageTimeLabel || 'Time',
          guestPageVenueLabel: data.guestPageVenueLabel || local.guestPageVenueLabel || 'Venue',
          guestPageRsvpHint: data.guestPageRsvpHint || local.guestPageRsvpHint || 'Kindly RSVP so we can plan for you',
        });
      })
      .catch(() => setDraft(local))
      .finally(() => setLoading(false));
  }, [activeApiUrl, activeDraftKey]);

  // ─── Auto-save draft ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(activeDraftKey, JSON.stringify(draft)); } catch { /* */ }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, loading, activeDraftKey]);

  const set = (key: keyof Draft, value: string) => setDraft(d => ({ ...d, [key]: value }));

  const addThemeColor = () => {
    if (draft.themeColors.length >= 6) { toast.error('Up to 6 theme colors'); return; }
    setDraft(d => ({ ...d, themeColors: [...d.themeColors, draft.guestPageThemeColor || '#E8C46B'] }));
  };

  const updateThemeColor = (index: number, color: string) => {
    setDraft(d => ({ ...d, themeColors: d.themeColors.map((c, i) => (i === index ? color : c)) }));
  };

  const removeThemeColor = (index: number) => {
    setDraft(d => ({ ...d, themeColors: d.themeColors.filter((_, i) => i !== index) }));
  };

  const fontClass = fontStack(draft.guestPageFontFamily);

  const previewInitials = (draft.guestPageTitle || 'J & J Night').replace(/\s*Night$/i, '');

  // ─── Save settings ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(activeApiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
        credentials: 'include',
      });
      if (res.ok) {
        const savedFor = selectedEventId === '__tenant__' ? 'default' : events.find(e => e.id === selectedEventId)?.name || 'this event';
        toast.success(selectedEventId === '__tenant__' ? 'Default guest page settings saved' : `"${savedFor}" guest page settings saved`);
        try { localStorage.removeItem(activeDraftKey); } catch { /* */ }
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

  // ─── Uploads (header background + bride & groom photo) ─────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'header' | 'couple') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('kind', kind);
      const res = await fetch(activeUploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.url) {
        set(kind === 'header' ? 'guestPageHeaderImage' : 'guestPageCoupleImage', data.url);
        toast.success(kind === 'header' ? 'Header image uploaded' : 'Bride & groom photo uploaded');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(null);
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
    <div className={embedded ? 'w-full' : 'max-w-2xl mx-auto px-4 sm:px-6 py-6'}>
      {/* ─── Header ────────────────────────────────────────────────── */}
      {!embedded && (
        <div className="flex items-center gap-3 mb-7">
          <Link
            href={backHref}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:text-[#0D4B4B] hover:border-[#0D4B4B] transition"
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">Appearance</p>
            <h1 className="font-serif text-3xl font-black text-gray-900 leading-tight">{title}</h1>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          </div>
        </div>
      )}

      {/* ─── Event selector ─────────────────────────────────────────── */}
      {enableEventSelect && (
        <div className="bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] rounded-2xl p-5 mb-5 shadow-md shadow-[#0D4B4B]/20">
          <label className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-[2px] mb-2.5">
            <HeartHandshake size={14} /> Customize for a specific event
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <select
              value={selectedEventId}
              onChange={e => {
                setLoading(true);
                setSelectedEventId(e.target.value);
              }}
              className="flex-1 px-3.5 py-2.5 bg-white border border-white/20 rounded-xl text-sm focus:ring-2 focus:ring-white/30 outline-none transition-all appearance-none"
            >
              <option value="__tenant__">Default — applies to all events</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} · {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#9CC4C4] sm:max-w-[15rem] sm:text-right m-0">
              {selectedEventId === '__tenant__'
                ? 'Changes here become the default for every event'
                : events.find(e => e.id === selectedEventId)?.name
                  ? `Editing "${events.find(e => e.id === selectedEventId)?.name}" only`
                  : 'Editing settings for this event only'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* ─── Theme Colors ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Wedding Colors</h2>
            <div className="space-y-4">
              {COLOR_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 m-0">{f.label}</p>
                    <p className="text-[11px] text-gray-400 m-0 mt-0.5">{f.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner" style={{ backgroundColor: draft[f.key] }} />
                    <ModernColorPicker
                      value={draft[f.key]}
                      onChange={(c: string) => set(f.key, c)}
                      className="w-36"
                    />
                  </div>
                </div>
              ))}
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
              Preview: J &amp; J Night
            </p>
          </div>
        </div>

        {/* ─── Wedding Theme & Colors ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-1 flex items-center gap-2">
              <PaletteIcon size={17} className="text-[#0D4B4B]" /> Wedding Theme
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Give the celebration a name and a palette. Guests will see the words and matching color circles under Date &amp; Venue.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Theme name / code</label>
                <input
                  value={draft.weddingTheme}
                  onChange={e => set('weddingTheme', e.target.value)}
                  placeholder="e.g. Brown & Lavender"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Theme colors</label>
                <p className="text-[11px] text-gray-400 mb-2">Shown as a row of elegant circles next to the theme name.</p>
                <div className="flex flex-wrap gap-3">
                  {draft.themeColors.map((color, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <div
                          className="w-10 h-10 rounded-full border-2 border-white shadow-md"
                          style={{ backgroundColor: color, boxShadow: `0 4px 12px -4px ${color}` }}
                        />
                        <button
                          type="button"
                          onClick={() => removeThemeColor(idx)}
                          className="absolute -top-1 -right-1 w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
                          title="Remove color"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <ModernColorPicker value={color} onChange={(c: string) => updateThemeColor(idx, c)} className="w-28" />
                    </div>
                  ))}
                  {draft.themeColors.length < 6 && (
                    <button
                      type="button"
                      onClick={addThemeColor}
                      className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 text-gray-400 flex items-center justify-center hover:border-[#0D4B4B] hover:text-[#0D4B4B] transition"
                      title="Add theme color"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Event Contacts & Map ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Event Contacts &amp; Location</h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <Phone size={13} className="text-[#0D4B4B]" /> Contact person
                </label>
                <input
                  value={draft.contactPerson}
                  onChange={e => set('contactPerson', e.target.value)}
                  placeholder="e.g. Aunt Mary, +255 712 000 000"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1">Who can guests call with questions (with phone number).</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <Phone size={13} className="text-[#0D4B4B]" /> Contact phone number
                </label>
                <input
                  value={draft.contactPersonPhone}
                  onChange={e => set('contactPersonPhone', e.target.value)}
                  placeholder="e.g. +255 712 000 000"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <MicVocal size={13} className="text-[#0D4B4B]" /> Master of Ceremony (MC)
                </label>
                <input
                  value={draft.masterOfCeremony}
                  onChange={e => set('masterOfCeremony', e.target.value)}
                  placeholder="e.g. MC John Doe"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <MapPin size={13} className="text-[#0D4B4B]" /> Google Maps URL
                </label>
                <input
                  value={draft.mapUrl}
                  onChange={e => set('mapUrl', e.target.value)}
                  placeholder="https://maps.app.goo.gl/...  or  https://www.google.com/maps/..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  An embedded map of the venue is shown on the invitee page.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Invitee Page Text ─────────────────────────────────────── */}
        {(<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-1">Invitee Page Text</h2>
            <p className="text-[11px] text-gray-400 mb-4">
              Leave blank to use your default. Event settings override the tenant-wide defaults.
            </p>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <HeartHandshake size={13} className="text-[#0D4B4B]" /> Opening cover hint
                </label>
                <input
                  value={draft.guestPageCoverHint}
                  onChange={e => set('guestPageCoverHint', e.target.value)}
                  placeholder="e.g. Tap anywhere to open"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <HeartHandshake size={13} className="text-[#0D4B4B]" /> Opening cover subtitle
                </label>
                <input
                  value={draft.guestPageCoverSubtitle}
                  onChange={e => set('guestPageCoverSubtitle', e.target.value)}
                  placeholder="e.g. your invitation awaits"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <HeartHandshake size={13} className="text-[#0D4B4B]" /> Greeting above guest name
                </label>
                <input
                  value={draft.guestPageGreetingText}
                  onChange={e => set('guestPageGreetingText', e.target.value)}
                  placeholder="e.g. we would be honored to have you join us"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <PaletteIcon size={13} className="text-[#0D4B4B]" /> Theme section label
                </label>
                <input
                  value={draft.guestPageThemeLabel}
                  onChange={e => set('guestPageThemeLabel', e.target.value)}
                  placeholder="e.g. Wedding · Ceremony Theme"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <ImageIcon size={13} className="text-[#0D4B4B]" /> Invitation card label
                </label>
                <input
                  value={draft.guestPageInvitationCardLabel}
                  onChange={e => set('guestPageInvitationCardLabel', e.target.value)}
                  placeholder="e.g. Your invitation card"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">Date label</label>
                  <input
                    value={draft.guestPageDateLabel}
                    onChange={e => set('guestPageDateLabel', e.target.value)}
                    placeholder="Date"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">Time label</label>
                  <input
                    value={draft.guestPageTimeLabel}
                    onChange={e => set('guestPageTimeLabel', e.target.value)}
                    placeholder="Time"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">Venue label</label>
                  <input
                    value={draft.guestPageVenueLabel}
                    onChange={e => set('guestPageVenueLabel', e.target.value)}
                    placeholder="Venue"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <HeartHandshake size={13} className="text-[#0D4B4B]" /> Reception notes label
                </label>
                <input
                  value={draft.guestPageReceptionLabel}
                  onChange={e => set('guestPageReceptionLabel', e.target.value)}
                  placeholder="e.g. Reception Notes"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <Phone size={13} className="text-[#0D4B4B]" /> Contact label
                </label>
                <input
                  value={draft.guestPageContactLabel}
                  onChange={e => set('guestPageContactLabel', e.target.value)}
                  placeholder="e.g. Contact Person"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <MicVocal size={13} className="text-[#0D4B4B]" /> Master of Ceremony label
                </label>
                <input
                  value={draft.guestPageMocLabel}
                  onChange={e => set('guestPageMocLabel', e.target.value)}
                  placeholder="e.g. Master of Ceremony"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <MapPin size={13} className="text-[#0D4B4B]" /> Map button label
                </label>
                <input
                  value={draft.guestPageMapLabel}
                  onChange={e => set('guestPageMapLabel', e.target.value)}
                  placeholder="e.g. Find the Venue"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                    <HeartHandshake size={13} className="text-[#0D4B4B]" /> Wishes section title
                  </label>
                  <input
                    value={draft.guestPageWishesTitle}
                    onChange={e => set('guestPageWishesTitle', e.target.value)}
                    placeholder="e.g. Wedding Wishes"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                    <HeartHandshake size={13} className="text-[#0D4B4B]" /> Wishes hint text
                  </label>
                  <input
                    value={draft.guestPageWishesHint}
                    onChange={e => set('guestPageWishesHint', e.target.value)}
                    placeholder="e.g. Leave a little love for the couple"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <HeartHandshake size={13} className="text-[#0D4B4B]" /> RSVP hint text
                </label>
                <input
                  value={draft.guestPageRsvpHint}
                  onChange={e => set('guestPageRsvpHint', e.target.value)}
                  placeholder="e.g. Kindly RSVP so we can plan for you"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>)}

        {/* ─── Photos ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Photos</h2>

            {/* Header background */}
            <p className="text-xs text-gray-400 mb-1.5">
              <ImageIcon size={12} className="inline mr-1 text-gray-300" />
              Hero background — optional. Adds a photo behind the gradient overlay.
            </p>
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
              ref={headerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleImageUpload(e, 'header')}
            />
            <button
              type="button"
              onClick={() => headerInputRef.current?.click()}
              disabled={uploading !== null}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-[#0D4B4B]/40 hover:bg-[#0D4B4B]/[0.03] transition disabled:opacity-50 mb-5"
            >
              {uploading === 'header' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading === 'header' ? 'Uploading...' : 'Upload background'}
            </button>

            {/* Bride & groom photo */}
            <p className="text-xs text-gray-400 mb-1.5">
              <HeartHandshake size={12} className="inline mr-1 text-gray-300" />
              Bride &amp; groom photo — optional. Shown in an elegant circle on the landing page. The page looks great with or without it.
            </p>
            {draft.guestPageCoupleImage && (
              <div className="mb-3 relative w-36 h-36 rounded-full overflow-hidden mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.guestPageCoupleImage}
                  alt="Bride and groom"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => set('guestPageCoupleImage', '')}
                  className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-600 transition"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}
            <input
              ref={coupleInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleImageUpload(e, 'couple')}
            />
            <button
              type="button"
              onClick={() => coupleInputRef.current?.click()}
              disabled={uploading !== null}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-[#0D4B4B]/40 hover:bg-[#0D4B4B]/[0.03] transition disabled:opacity-50"
            >
              {uploading === 'couple' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading === 'couple' ? 'Uploading...' : (draft.guestPageCoupleImage ? 'Change photo' : 'Upload bride & groom photo')}
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
                {/* Couple photo or monogram */}
                <div className="flex justify-center mb-3">
                  {draft.guestPageCoupleImage ? (
                    <div
                      className="w-20 h-20 rounded-full overflow-hidden border-4"
                      style={{ borderColor: draft.guestPageThemeColor }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.guestPageCoupleImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-xl border-2"
                      style={{
                        borderColor: `${draft.guestPageThemeColor}aa`,
                        background: `${draft.guestPageThemeColor}22`,
                        color: draft.guestPageThemeColor,
                      }}
                    >
                      {(previewInitials || 'J&J').split(' & ').map(p => p[0] || '').join(' & ')}
                    </div>
                  )}
                </div>
                <div className="text-2xl mb-2 opacity-60" style={{ color: draft.guestPageThemeColor }}>&#10053;</div>
                <p
                  className="text-[11px] uppercase tracking-[3px] font-semibold mb-3"
                  style={{ color: draft.guestPageThemeColor }}
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
                {/* Decorative divider */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="h-px w-10" style={{ backgroundColor: draft.guestPageThemeColor, opacity: 0.6 }} />
                  <span className="text-sm" style={{ color: draft.guestPageThemeColor }}>&#9830;</span>
                  <span className="h-px w-10" style={{ backgroundColor: draft.guestPageThemeColor, opacity: 0.6 }} />
                </div>
                {/* Wedding theme + color dots */}
                {draft.weddingTheme && (
                  <p className="gp-script text-2xl mt-3 leading-tight" style={{ color: draft.guestPageThemeColor }}>
                    {draft.weddingTheme}
                  </p>
                )}
                {draft.themeColors.length > 0 && (
                  <div className="flex justify-center gap-2 mt-2">
                    {draft.themeColors.map((c, i) => (
                      <span
                        key={i}
                        className="w-3 h-3 rounded-full border border-white/70 gp-color-dot-glow"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
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
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPageThemeColor + '18', color: draft.guestPageThemeColor }}>📍</span>
                    <span>Galilaya Hall, Ubungo</span>
                  </div>
                  {draft.contactPerson && (
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPagePrimaryColor + '18', color: draft.guestPagePrimaryColor }}>📞</span>
                      <span>{draft.contactPerson}{draft.contactPersonPhone ? ` · ${draft.contactPersonPhone}` : ''}</span>
                    </div>
                  )}
                  {draft.masterOfCeremony && (
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: draft.guestPageSecondaryColor + '18', color: draft.guestPageSecondaryColor }}>🎤</span>
                      <span>{draft.masterOfCeremony}</span>
                    </div>
                  )}
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
            <><Save size={16} /> Save Guest Page Settings</>
          )}
        </button>
      </div>
    </div>
  );
}