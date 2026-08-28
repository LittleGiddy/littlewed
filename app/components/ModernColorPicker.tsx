'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pipette } from 'lucide-react';

type Rgba = { r: number; g: number; b: number; a: number };
type Hsva = { h: number; s: number; v: number; a: number };
type DragMode = 'sv' | 'hue' | 'alpha' | null;

const CHECKER = {
  backgroundImage: 'repeating-conic-gradient(#d1d5db 0% 25%, #ffffff 0% 50%)',
  backgroundSize: '10px 10px',
} as const;

const PRESETS = [
  '#FFFFFF', '#F3F4F6', '#E5E7EB', '#9CA3AF', '#4B5563', '#111827', '#000000',
  '#0D4B4B', '#0A3939', '#FF6B5C', '#FBBF24', '#F9A8D4', '#A78BFA', '#60A5FA',
  '#34D399', '#F87171', '#FB923C', '#FACC15', '#22D3EE', '#2DD4BF', '#E879F9',
  '#C2410C', '#B45309', '#92400E', '#78350F', '#7C2D12', '#881337', '#164E63',
];

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

function parseColor(input: string): Rgba {
  const str = (input || '').trim();
  if (!str) return { r: 0, g: 0, b: 0, a: 1 };

  const hex = str.match(/^#?([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return {
      r: isNaN(r) ? 0 : r,
      g: isNaN(g) ? 0 : g,
      b: isNaN(b) ? 0 : b,
      a: isNaN(a) ? 1 : a,
    };
  }

  const rgb = str.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((s) => parseFloat(s.trim()));
    const r = parts[0] || 0;
    const g = parts[1] || 0;
    const b = parts[2] || 0;
    const a = parts.length > 3 && !isNaN(parts[3]) ? parts[3] : 1;
    return { r: clamp(r), g: clamp(g), b: clamp(b), a: clamp(a, 0, 1) };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbToHsv(c: Rgba): Hsva {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: Math.round(h), s, v: max, a: c.a };
}

function hsvToRgba(c: Hsva): Rgba {
  const h = ((c.h % 360) + 360) % 360;
  const s = clamp(c.s, 0, 1);
  const v = clamp(c.v, 0, 1);
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: clamp(c.a, 0, 1),
  };
}

function hexFromRgb(c: Rgba): string {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function rgbaToString(c: Rgba, withAlpha: boolean): string {
  if (withAlpha && c.a < 1) {
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 100) / 100})`;
  }
  return hexFromRgb(c);
}

interface ModernColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  withAlpha?: boolean;
  className?: string;
}

export default function ModernColorPicker({
  value,
  onChange,
  withAlpha = false,
  className = '',
}: ModernColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem('modern-color-recent');
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const [hsv, setHsv] = useState<Hsva>(() => rgbToHsv(parseColor(value)));

  const rgba = useMemo(() => hsvToRgba(hsv), [hsv]);
  const opaqueHex = hexFromRgb(rgba);
  const currentLabel = withAlpha && rgba.a < 1 ? rgbaToString(rgba, true) : opaqueHex;

  const persistRecent = (str: string) => {
    setRecent((prev) => {
      const list = [str, ...prev.filter((c) => c.toLowerCase() !== str.toLowerCase())].slice(0, 8);
      try {
        window.localStorage.setItem('modern-color-recent', JSON.stringify(list));
      } catch {
        /* ignore */
      }
      return list;
    });
  };

  const emit = (next: Hsva) => {
    onChange(rgbaToString(hsvToRgba(next), withAlpha));
  };

  const apply = (next: Hsva, saveRecent = false) => {
    setHsv(next);
    emit(next);
    if (saveRecent) persistRecent(rgbaToString(hsvToRgba(next), withAlpha));
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    setHexDraft(null);
    setHsv(rgbToHsv(parseColor(value)));
    const rect = trigger.getBoundingClientRect();
    const width = 272;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (top + 430 > window.innerHeight) top = Math.max(8, rect.top - 430);
    setPos({ top, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && e.target instanceof Node && !popRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const updateSv = (e: React.PointerEvent) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    const next = { ...hsv, s, v };
    setHsv(next);
    emit(next);
  };

  const updateHue = (e: React.PointerEvent) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const next = { ...hsv, h: Math.round(t * 360) };
    setHsv(next);
    emit(next);
  };

  const updateAlpha = (e: React.PointerEvent) => {
    const el = alphaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const next = { ...hsv, a: Math.round(t * 100) / 100 };
    setHsv(next);
    emit(next);
  };

  const setChannel = (ch: 'r' | 'g' | 'b', raw: string) => {
    const v = Number(raw);
    if (isNaN(v)) return;
    const rgb = hsvToRgba(hsv);
    rgb[ch] = clamp(v);
    apply(rgbToHsv(rgb));
  };

  const onHexChange = (raw: string) => {
    setHexDraft(raw);
    const trimmed = raw.trim();
    if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return;
    const parsed = parseColor(trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
    apply({ ...hsv, ...rgbToHsv(parsed) });
  };

  const pickerAvailable = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickFromScreen = async () => {
    try {
      const Ctor = (window as unknown as {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
      }).EyeDropper;
      const result = await new Ctor().open();
      if (result && result.sRGBHex) {
        apply(rgbToHsv(parseColor(result.sRGBHex)), true);
      }
    } catch {
      /* user cancelled */
    }
  };

  const hueBg = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white hover:border-[#0D4B4B]/50 transition p-1 pr-2 h-8 w-full ${className}`}
      >
        <span
          className="w-5 h-5 rounded-md border border-gray-300 shrink-0 relative overflow-hidden"
          style={{ ...CHECKER, backgroundColor: '#fff' }}
        >
          <span
            className="absolute inset-0"
            style={{
              backgroundColor: opaqueHex,
              opacity: withAlpha ? rgba.a : 1,
            }}
          />
        </span>
        <span className="text-[10px] font-mono text-gray-600 truncate flex-1">{currentLabel}</span>
        <span
          className="text-[#0D4B4B] text-xs transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>

      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label="Color picker"
              className="fixed z-[100] rounded-xl bg-white shadow-2xl border border-gray-200 p-3"
              style={{ top: pos.top, left: pos.left, width: 272, maxHeight: 'min(430px, 92vh)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-md border border-gray-300 relative overflow-hidden"
                    style={{ ...CHECKER, backgroundColor: '#fff' }}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ backgroundColor: opaqueHex, opacity: withAlpha ? rgba.a : 1 }}
                    />
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-gray-800">{currentLabel}</span>
                </div>
                {pickerAvailable && (
                  <button
                    type="button"
                    onClick={pickFromScreen}
                    className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-[#0D4B4B] hover:text-white transition"
                    title="Pick color from screen"
                  >
                    <Pipette size={14} />
                  </button>
                )}
              </div>

              <div
                ref={svRef}
                className="relative rounded-md select-none touch-none cursor-crosshair"
                style={{
                  height: 150,
                  background: `linear-gradient(to top, #000 0%, transparent 100%), linear-gradient(to right, #fff 0%, transparent 100%), ${hueBg}`,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                  setDragMode('sv');
                  updateSv(e);
                }}
                onPointerMove={(e) => {
                  if (dragMode === 'sv') updateSv(e);
                }}
                onPointerUp={() => {
                  setDragMode(null);
                  apply(hsv, true);
                }}
              >
                <span
                  className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
                  style={{
                    left: `${hsv.s * 100}%`,
                    top: `${(1 - hsv.v) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                  }}
                />
              </div>

              <div className="mt-2">
                <div
                  ref={hueRef}
                  className="relative h-3 rounded-full cursor-pointer touch-none"
                  style={{
                    background:
                      'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                    setDragMode('hue');
                    updateHue(e);
                  }}
                  onPointerMove={(e) => {
                    if (dragMode === 'hue') updateHue(e);
                  }}
                  onPointerUp={() => {
                    setDragMode(null);
                    apply(hsv, true);
                  }}
                >
                  <span
                    className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white pointer-events-none bg-transparent"
                    style={{
                      left: `calc(${(hsv.h / 360) * 100}% - 8px)`,
                      top: -2,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                    }}
                  />
                </div>

                {withAlpha && (
                  <div className="mt-2">
                    <div
                      ref={alphaRef}
                      className="relative h-3 rounded-full cursor-pointer touch-none"
                      style={{ ...CHECKER, backgroundColor: '#fff' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {
                          /* ignore */
                        }
                        setDragMode('alpha');
                        updateAlpha(e);
                      }}
                      onPointerMove={(e) => {
                        if (dragMode === 'alpha') updateAlpha(e);
                      }}
                      onPointerUp={() => {
                        setDragMode(null);
                        apply(hsv, true);
                      }}
                    >
                      <span
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ background: `linear-gradient(to right, transparent, ${opaqueHex})` }}
                      />
                      <span
                        className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white pointer-events-none bg-white"
                        style={{
                          left: `${rgba.a * 100}%`,
                          transform: 'translate(-50%, -32%)',
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <label className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-gray-400">HEX</span>
                  <input
                    value={hexDraft ?? opaqueHex}
                    onChange={(e) => onHexChange(e.target.value)}
                    onFocus={() => setHexDraft('')}
                    onBlur={() => setHexDraft(null)}
                    className="w-full pl-1 py-1 border border-gray-200 rounded-md text-[10px] font-mono focus:ring-1 focus:ring-[#0D4B4B] focus:border-transparent"
                    spellCheck={false}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-1 mt-1.5">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <label key={ch} className="flex items-center gap-1.5 bg-gray-50 rounded-md px-1.5 py-1">
                    <span className="text-[8px] font-bold uppercase text-gray-400">{ch}</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={rgba[ch]}
                      onChange={(e) => setChannel(ch, e.target.value)}
                      className="w-full bg-transparent text-[10px] font-mono text-gray-700 focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-2">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Swatches</p>
                <div className="grid grid-cols-7 gap-1">
                  {PRESETS.map((c) => {
                    const active = c.toLowerCase() === opaqueHex.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => apply(rgbToHsv(parseColor(c)), true)}
                        className={`h-5 rounded border ${active ? 'border-[#0D4B4B] ring-1 ring-[#0D4B4B] scale-110' : 'border-gray-200 hover:border-gray-400'}`}
                        style={{ backgroundColor: c }}
                      >
                        {active && <Check size={10} className="m-auto text-white mix-blend-difference" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {recent.length > 0 && (
                <div className="mt-2">
                  <p className="text-[8px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Recent</p>
                  <div className="grid grid-cols-8 gap-1">
                    {recent.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => apply(rgbToHsv(parseColor(c)))}
                        className={`h-5 rounded border ${
                          c.toLowerCase() === currentLabel.toLowerCase()
                            ? 'border-[#0D4B4B] ring-1 ring-[#0D4B4B]'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        style={c.startsWith('rgba') ? { ...CHECKER } : { backgroundColor: c }}
                      >
                        {c.startsWith('rgba') && (
                          <span className="absolute inset-0" style={{ backgroundColor: c }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}