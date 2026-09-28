'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageUp, Loader2, Trash2, LayoutTemplate,
  Sparkles, Minus, Plus, RotateCcw, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ModernColorPicker from '@/app/components/ModernColorPicker';

// Same list as the invitation designer so both screens feel identical.
export const REMINDER_FONTS = [
  'Playfair Display', 'DM Sans', 'Roboto', 'Lora', 'Montserrat',
  'Georgia', 'Open Sans', 'Raleway', 'Nunito', 'Poppins',
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script',
];

export interface CardTemplate {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ReminderDesign {
  x: number;   // % from left
  y: number;   // % from top
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  font: string;
}

export const DEFAULT_REMINDER_DESIGN: ReminderDesign = {
  x: 50,
  y: 42,
  size: 34,
  color: '#ffffff',
  align: 'center',
  font: 'Playfair Display',
};

// The token the user positions on the card. Each guest's own name replaces it
// when the card is composed server-side, exactly like {guestName} on the
// invitation designer.
export const GUEST_NAME_TOKEN = '{GuestName}';

const QUICK_Y: Array<{ label: string; y: number }> = [
  { label: 'Top', y: 18 },
  { label: 'Upper', y: 32 },
  { label: 'Middle', y: 50 },
  { label: 'Lower', y: 68 },
  { label: 'Bottom', y: 84 },
];

interface Props {
  eventId: string;
  cardUrl: string | null;
  design: ReminderDesign;
  sampleName: string;
  onChange: (next: { cardUrl: string | null; design: ReminderDesign }) => void;
}

export default function ReminderCardDesigner({
  eventId,
  cardUrl,
  design,
  sampleName,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [guides, setGuides] = useState({ x: false, y: false });

  const patch = useCallback(
    (p: Partial<ReminderDesign>) => onChange({ cardUrl, design: { ...design, ...p } }),
    [cardUrl, design, onChange]
  );

  // ─── Approved template gallery ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/templates', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setTemplates(data);
      } catch {
        // Gallery is optional - uploads still work without it.
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Upload ─────────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Please choose a JPEG, JPG or PNG image.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 1MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('eventId', eventId);
      const res = await fetch('/api/events/upload-reminder-card', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange({ cardUrl: data.url, design });
      toast.success('Card added. Now place the guest name on it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, [eventId, design, onChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  // ─── Drag the name token around the canvas ─────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.min(95, Math.max(5, x));
    const clampedY = Math.min(92, Math.max(8, y));

    // Snap guides when the token is near the centre lines.
    setGuides({
      x: design.align === 'center' && Math.abs(clampedX - 50) < 2,
      y: Math.abs(clampedY - 50) < 2,
    });
    patch({ x: Math.round(clampedX * 10) / 10, y: Math.round(clampedY * 10) / 10 });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
    setDragging(false);
    setGuides({ x: false, y: false });
  };

  // ─── Nudge with arrow keys ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!cardUrl) return;
      const step = e.shiftKey ? 5 : 1;
      const moves: Record<string, Partial<ReminderDesign>> = {
        ArrowLeft: { x: design.x - step },
        ArrowRight: { x: design.x + step },
        ArrowUp: { y: design.y - step },
        ArrowDown: { y: design.y + step },
      };
      if (moves[e.key]) {
        e.preventDefault();
        const next = moves[e.key];
        patch({
          x: Math.min(95, Math.max(5, design.x + (next.x! - design.x))),
          y: Math.min(92, Math.max(8, design.y + (next.y! - design.y))),
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardUrl, design.x, design.y, patch]);

  // ─── No card yet: gallery + upload ─────────────────────────────────────
  if (!cardUrl) {
    return (
      <div className="space-y-3">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`block rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
            dragOver ? 'border-[#25D366] bg-[#25D366]/5' : 'border-gray-200 hover:border-[#25D366]/60 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpeg,.jpg,.png,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) uploadFile(f);
            }}
          />
          {uploading ? (
            <Loader2 size={26} className="mx-auto text-[#0D4B4B] animate-spin" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#0D4B4B]/[0.07] flex items-center justify-center mx-auto mb-2">
                <ImageUp size={22} className="text-[#0D4B4B]" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Drop your card here</p>
              <p className="text-xs text-gray-400 mt-0.5">or tap to browse · JPEG, JPG, PNG · max 1MB</p>
            </>
          )}
        </label>

        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <LayoutTemplate size={13} className="text-[#0D4B4B]" /> Approved cards
          </p>
          {loadingTemplates ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-gray-300" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No approved cards yet.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ cardUrl: t.imageUrl, design })}
                  className="group relative rounded-xl overflow-hidden border border-gray-200 hover:border-[#0D4B4B] transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl} alt={t.name} className="w-full h-20 object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] px-1 py-0.5 truncate">
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Canvas + controls ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div className="rounded-2xl bg-[#1c1c1e] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition ${
              showToken ? 'bg-[#25D366] text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            <Sparkles size={12} />
            {showToken ? 'Showing {GuestName}' : 'Showing sample'}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
              className="w-7 h-7 rounded-lg bg-white/10 text-white/80 flex items-center justify-center hover:bg-white/20"
            >
              <Minus size={12} />
            </button>
            <span className="text-[10px] text-white/60 tabular-nums w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(1.6, Math.round((z + 0.2) * 10) / 10))}
              className="w-7 h-7 rounded-lg bg-white/10 text-white/80 flex items-center justify-center hover:bg-white/20"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[46vh]">
          {/* min-w-full + justify-center centres the canvas without clipping the
              left edge when zoomed in and the content is wider than the panel. */}
          <div className="min-w-full flex justify-center">
            <div
              ref={canvasRef}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative select-none shrink-0"
              style={{ width: `${100 * zoom}%`, maxWidth: 420, containerType: 'inline-size' }}
            >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt="Reminder card" className="w-full h-auto block rounded-xl" draggable={false} />

            {/* Snap guides */}
            {guides.x && <div className="absolute top-0 bottom-0 w-px bg-[#25D366] pointer-events-none" style={{ left: '50%' }} />}
            {guides.y && <div className="absolute left-0 right-0 h-px bg-[#25D366] pointer-events-none" style={{ top: '50%' }} />}

            {/* The draggable name token */}
            <div
              onPointerDown={onPointerDown}
              role="button"
              tabIndex={0}
              aria-label="Drag to position the guest name"
              className={`absolute cursor-grab active:cursor-grabbing touch-none select-none ${
                dragging ? '' : 'hover:ring-1 hover:ring-[#25D366]/60'
              }`}
              style={{
                top: `${design.y}%`,
                left: `${design.x}%`,
                // Must match the server's textSvg anchoring exactly, otherwise
                // the name lands in a different place on the sent card:
                //   left   -> the name's left edge sits on x
                //   center -> the name is centred on x
                //   right  -> the name's right edge sits on x
                transform:
                  design.align === 'center'
                    ? 'translate(-50%, -50%)'
                    : design.align === 'right'
                      ? 'translate(-100%, -50%)'
                      : 'translate(0, -50%)',
              }}
            >
              <span
                className="inline-block font-bold whitespace-nowrap leading-tight px-1.5 py-0.5 rounded-md"
                style={{
                  // Mirrors the server: fontSize = size * (width / 800)
                  fontSize: `calc(${design.size || 34} / 8 * 1cqw)`,
                  color: design.color || '#ffffff',
                  fontFamily: `'${design.font}', Georgia, serif`,
                  textAlign: design.align,
                  background: showToken ? 'rgba(37,211,102,0.18)' : 'rgba(0,0,0,0.18)',
                  outline: showToken ? '1px dashed rgba(37,211,102,0.9)' : 'none',
                }}
              >
                {showToken ? GUEST_NAME_TOKEN : (sampleName || 'Guest name')}
              </span>
              {/* Grab handle */}
              <span
                className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] bg-[#25D366] text-white px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5 pointer-events-none whitespace-nowrap"
              >
                <GripVertical size={9} /> name
              </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-white/45 text-center mt-2">
          Drag the name to position it · tap “{GUEST_NAME_TOKEN}” to preview the token
        </p>
      </div>

      {/* Quick vertical placement */}
      <div className="flex gap-1.5">
        {QUICK_Y.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => patch({ y: q.y })}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition ${
              Math.abs(design.y - q.y) < 1
                ? 'bg-[#0D4B4B] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Style controls */}
      <div className="space-y-3 bg-white rounded-2xl border border-gray-100 p-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Font</label>
          <select
            value={design.font}
            onChange={(e) => patch({ font: e.target.value })}
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
          >
            {REMINDER_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: `'${f}', Georgia, serif` }}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-500">Size</label>
            <span className="text-[11px] text-gray-400 tabular-nums">{design.size}px</span>
          </div>
          <input
            type="range"
            min={14}
            max={90}
            value={design.size}
            onChange={(e) => patch({ size: Number(e.target.value) })}
            className="w-full accent-[#0D4B4B]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Alignment</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patch({ align: a })}
                className={`py-2 rounded-xl text-[11px] font-semibold capitalize transition ${
                  design.align === a
                    ? 'bg-[#0D4B4B] text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-600'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Text colour</label>
          <ModernColorPicker value={design.color} onChange={(c) => patch({ color: c })} />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChange({ cardUrl, design: { ...DEFAULT_REMINDER_DESIGN, x: design.x, y: design.y, font: design.font, color: design.color } })}
            className="px-3 border border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 flex items-center gap-1.5 text-xs font-semibold"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={() => { onChange({ cardUrl: null, design: DEFAULT_REMINDER_DESIGN }); toast.success('Card removed'); }}
            className="ml-auto px-3 border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}
