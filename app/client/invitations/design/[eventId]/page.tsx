'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Move, Maximize2, Save, Loader2, Image, Trash2, Check, Type, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Square } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Google Fonts list ────────────────────────────────────────────────────
const FONTS = [
  'Playfair Display',
  'DM Sans',
  'Roboto',
  'Lora',
  'Montserrat',
  'Georgia',
  'Open Sans',
  'Raleway',
  'Nunito',
  'Poppins',
];

// ─── Alignment presets ──────────────────────────────────────────────────
const ALIGN_H = [
  { label: 'L', value: 0 },
  { label: 'C', value: 50 },
  { label: 'R', value: 100 },
];
const ALIGN_V = [
  { label: 'T', value: 0 },
  { label: 'M', value: 50 },
  { label: 'B', value: 100 },
];

export default function InvitationDesigner() {
  const { eventId } = useParams();
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Overlay
  const [overlayColor, setOverlayColor] = useState('#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(0.2);

  // QR
  const [qrX, setQrX] = useState(100);
  const [qrY, setQrY] = useState(100);
  const [qrSize, setQrSize] = useState(200);
  const [qrColor, setQrColor] = useState('#000000');

  // Guest Name
  const [includeName, setIncludeName] = useState(false);
  const [nameX, setNameX] = useState(50);
  const [nameY, setNameY] = useState(50);
  const [nameFontSize, setNameFontSize] = useState(24);
  const [nameFontColor, setNameFontColor] = useState('#ffffff');
  const [nameFont, setNameFont] = useState('Playfair Display');
  const [previewGuestName, setPreviewGuestName] = useState('Guest Name');

  // Event Name
  const [showEventName, setShowEventName] = useState(true);
  const [eventNameX, setEventNameX] = useState(50);
  const [eventNameY, setEventNameY] = useState(15);
  const [eventNameSize, setEventNameSize] = useState(28);
  const [eventNameColor, setEventNameColor] = useState('#ffffff');
  const [eventNameFont, setEventNameFont] = useState('Playfair Display');
  const [previewEventName, setPreviewEventName] = useState('');

  // Date
  const [showDate, setShowDate] = useState(true);
  const [dateX, setDateX] = useState(50);
  const [dateY, setDateY] = useState(25);
  const [dateSize, setDateSize] = useState(18);
  const [dateColor, setDateColor] = useState('#ffffff');
  const [dateFont, setDateFont] = useState('DM Sans');
  const [previewDate, setPreviewDate] = useState('');

  // Venue
  const [showVenue, setShowVenue] = useState(true);
  const [venueX, setVenueX] = useState(50);
  const [venueY, setVenueY] = useState(32);
  const [venueSize, setVenueSize] = useState(16);
  const [venueColor, setVenueColor] = useState('#ffffff');
  const [venueFont, setVenueFont] = useState('DM Sans');
  const [previewVenue, setPreviewVenue] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [event, setEvent] = useState<any>(null);

  // ─── Drag states ──────────────────────────────────────────────────────
  const [dragging, setDragging] = useState<string | null>(null); // 'qr' | 'eventName' | 'date' | 'venue' | 'name'
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [templatesRes, settingsRes, eventRes] = await Promise.all([
          fetch('/api/templates', { credentials: 'include' }),
          fetch(`/api/events/${eventId}/settings`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}`, { credentials: 'include' }),
        ]);
        const templatesData = await templatesRes.json();
        const settings = await settingsRes.json();
        const eventData = await eventRes.json();
        setTemplates(templatesData);
        setEvent(eventData.event || eventData);

        if (settings.templateCardUrl) {
          setTemplateUrl(settings.templateCardUrl);
          const matched = templatesData.find((t: any) => t.imageUrl === settings.templateCardUrl);
          if (matched) setSelectedTemplateId(matched.id);
        }

        // Load all settings
        setOverlayColor(settings.overlayColor ?? '#000000');
        setOverlayOpacity(settings.overlayOpacity ?? 0.2);
        setQrX(settings.qrPlacementX ?? 100);
        setQrY(settings.qrPlacementY ?? 100);
        setQrSize(settings.qrSize ?? 200);
        setQrColor(settings.qrColor ?? '#000000');

        setIncludeName(settings.includeName ?? false);
        setNameX(settings.namePlacementX ?? 50);
        setNameY(settings.namePlacementY ?? 50);
        setNameFontSize(settings.nameFontSize ?? 24);
        setNameFontColor(settings.nameFontColor ?? '#ffffff');
        setNameFont(settings.nameFontFamily ?? 'Playfair Display');

        setShowEventName(settings.showEventName ?? true);
        setEventNameX(settings.eventNameX ?? 50);
        setEventNameY(settings.eventNameY ?? 15);
        setEventNameSize(settings.eventNameSize ?? 28);
        setEventNameColor(settings.eventNameColor ?? '#ffffff');
        setEventNameFont(settings.eventNameFontFamily ?? 'Playfair Display');

        setShowDate(settings.showDate ?? true);
        setDateX(settings.dateX ?? 50);
        setDateY(settings.dateY ?? 25);
        setDateSize(settings.dateSize ?? 18);
        setDateColor(settings.dateColor ?? '#ffffff');
        setDateFont(settings.dateFontFamily ?? 'DM Sans');

        setShowVenue(settings.showVenue ?? true);
        setVenueX(settings.venueX ?? 50);
        setVenueY(settings.venueY ?? 32);
        setVenueSize(settings.venueSize ?? 16);
        setVenueColor(settings.venueColor ?? '#ffffff');
        setVenueFont(settings.venueFontFamily ?? 'DM Sans');
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [eventId]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const selectTemplate = (template: any) => {
    setSelectedTemplateId(template.id);
    setTemplateUrl(template.imageUrl);
  };

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
      if (res.ok) {
        setTemplateUrl(data.url);
        setSelectedTemplateId(null);
      } else toast.error('Upload failed');
    } catch { toast.error('Network error'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!templateUrl) {
      toast.error('Please select a template or upload a background');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCardUrl: templateUrl,
          overlayColor,
          overlayOpacity,
          qrPlacementX: qrX,
          qrPlacementY: qrY,
          qrSize,
          qrColor,
          includeName,
          namePlacementX: nameX,
          namePlacementY: nameY,
          nameFontSize,
          nameFontColor,
          nameFontFamily: nameFont,
          showEventName,
          eventNameX,
          eventNameY,
          eventNameSize,
          eventNameColor,
          eventNameFontFamily: eventNameFont,
          showDate,
          dateX,
          dateY,
          dateSize,
          dateColor,
          dateFontFamily: dateFont,
          showVenue,
          venueX,
          venueY,
          venueSize,
          venueColor,
          venueFontFamily: venueFont,
        }),
      });
      if (res.ok) {
        toast.success('Settings saved');
        router.push(`/client/invitations/send/${eventId}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Save failed');
      }
    } catch { toast.error('Network error'); }
    setSaving(false);
  };

  // ─── Drag handlers ────────────────────────────────────────────────────

  const startDrag = (type: string) => (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    let currentX, currentY;
    switch (type) {
      case 'qr': currentX = qrX; currentY = qrY; break;
      case 'eventName': currentX = eventNameX; currentY = eventNameY; break;
      case 'date': currentX = dateX; currentY = dateY; break;
      case 'venue': currentX = venueX; currentY = venueY; break;
      case 'name': currentX = nameX; currentY = nameY; break;
      default: return;
    }
    setDragOffset({
      x: clientX - rect.left - (currentX / 100) * rect.width,
      y: clientY - rect.top - (currentY / 100) * rect.height,
    });
    setDragging(type);
    e.preventDefault();
  };

  const moveDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !canvasRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    let newX = (clientX - rect.left - dragOffset.x) / rect.width * 100;
    let newY = (clientY - rect.top - dragOffset.y) / rect.height * 100;
    newX = Math.min(Math.max(0, newX), 100);
    newY = Math.min(Math.max(0, newY), 100);
    switch (dragging) {
      case 'qr': setQrX(newX); setQrY(newY); break;
      case 'eventName': setEventNameX(newX); setEventNameY(newY); break;
      case 'date': setDateX(newX); setDateY(newY); break;
      case 'venue': setVenueX(newX); setVenueY(newY); break;
      case 'name': setNameX(newX); setNameY(newY); break;
    }
    e.preventDefault();
  };

  const endDrag = () => setDragging(null);

  // ─── Alignment helpers ────────────────────────────────────────────────

  const alignElement = (type: string, h: number | null, v: number | null) => {
    switch (type) {
      case 'eventName':
        if (h !== null) setEventNameX(h);
        if (v !== null) setEventNameY(v);
        break;
      case 'date':
        if (h !== null) setDateX(h);
        if (v !== null) setDateY(v);
        break;
      case 'venue':
        if (h !== null) setVenueX(h);
        if (v !== null) setVenueY(v);
        break;
      case 'name':
        if (h !== null) setNameX(h);
        if (v !== null) setNameY(v);
        break;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDisplayText = (field: string) => {
    switch (field) {
      case 'eventName': return previewEventName || event?.name || 'Event Name';
      case 'date': return previewDate || (event?.date ? formatDate(event.date) : 'Date');
      case 'venue': return previewVenue || (event?.venue || 'Venue');
      case 'name': return previewGuestName || 'Guest Name';
      default: return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-3xl font-black text-gray-900 mb-2">Invitation Designer</h1>
      <p className="text-gray-500 mb-6">Choose a template, edit text, adjust colors, and position elements.</p>

      {/* Template Gallery */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Image size={18} className="text-[#0D4F4F]" /> Choose a Template</h2>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-[#0D4F4F] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition flex items-center gap-1">
              <Upload size={14} /> Upload
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" ref={fileInputRef} />
            </label>
            {templateUrl && (
              <button onClick={() => { setTemplateUrl(null); setSelectedTemplateId(null); }} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-200 transition flex items-center gap-1">
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition hover:shadow-md ${selectedTemplateId === t.id ? 'border-[#0D4F4F] shadow-md' : 'border-transparent'}`}
            >
              <img src={t.imageUrl} alt={t.name} className="w-full aspect-[3/4] object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs font-medium">{t.name}</p>
              </div>
              {selectedTemplateId === t.id && (
                <div className="absolute top-2 right-2 bg-[#0D4F4F] rounded-full p-1">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
        {templateUrl && !templates.some(t => t.imageUrl === templateUrl) && <p className="text-xs text-gray-500 mt-2">Custom uploaded card</p>}
      </div>

      {/* Main layout: Preview + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Preview */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Maximize2 size={18} className="text-[#0D4F4F]" /> Live Preview</h2>
            <div
              ref={canvasRef}
              className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] max-h-[600px] mx-auto"
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchEnd={endDrag}
              onTouchCancel={endDrag}
              onMouseMove={moveDrag}
              onTouchMove={moveDrag}
            >
              {templateUrl ? (
                <>
                  <img src={templateUrl} alt="Card preview" className="w-full h-full object-contain" />
                  {/* Artistic overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundColor: overlayColor, opacity: overlayOpacity }}
                  />
                  {/* Event Name */}
                  {showEventName && (
                    <div
                      className="absolute text-center font-bold cursor-move touch-none select-none pointer-events-auto"
                      style={{
                        left: `${eventNameX}%`,
                        top: `${eventNameY}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${eventNameSize}px`,
                        color: eventNameColor,
                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        fontFamily: eventNameFont,
                        width: '80%',
                      }}
                      onMouseDown={startDrag('eventName')}
                      onTouchStart={startDrag('eventName')}
                    >
                      {getDisplayText('eventName')}
                    </div>
                  )}
                  {/* Date */}
                  {showDate && (
                    <div
                      className="absolute text-center font-medium cursor-move touch-none select-none pointer-events-auto"
                      style={{
                        left: `${dateX}%`,
                        top: `${dateY}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${dateSize}px`,
                        color: dateColor,
                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        fontFamily: dateFont,
                      }}
                      onMouseDown={startDrag('date')}
                      onTouchStart={startDrag('date')}
                    >
                      {getDisplayText('date')}
                    </div>
                  )}
                  {/* Venue */}
                  {showVenue && (
                    <div
                      className="absolute text-center font-medium cursor-move touch-none select-none pointer-events-auto"
                      style={{
                        left: `${venueX}%`,
                        top: `${venueY}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${venueSize}px`,
                        color: venueColor,
                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        fontFamily: venueFont,
                      }}
                      onMouseDown={startDrag('venue')}
                      onTouchStart={startDrag('venue')}
                    >
                      {getDisplayText('venue')}
                    </div>
                  )}
                  {/* Guest Name */}
                  {includeName && (
                    <div
                      className="absolute text-center font-bold cursor-move touch-none select-none pointer-events-auto"
                      style={{
                        left: `${nameX}%`,
                        top: `${nameY}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${nameFontSize}px`,
                        color: nameFontColor,
                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        fontFamily: nameFont,
                        width: '80%',
                      }}
                      onMouseDown={startDrag('name')}
                      onTouchStart={startDrag('name')}
                    >
                      {getDisplayText('name')}
                    </div>
                  )}
                  {/* QR Code */}
                  <div
                    className="absolute border-2 border-white rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xs font-mono cursor-move touch-none select-none pointer-events-auto"
                    style={{
                      left: `${qrX}%`,
                      top: `${qrY}%`,
                      width: qrSize,
                      height: qrSize,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: qrColor === '#000000' ? 'rgba(0,0,0,0.4)' : qrColor,
                    }}
                    onMouseDown={startDrag('qr')}
                    onTouchStart={startDrag('qr')}
                  >
                    QR
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Image size={40} className="mx-auto mb-2" />
                    <p>Select a template or upload your own</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              Drag any text or QR box to reposition. Use alignment buttons for quick positioning.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overlay */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Palette size={18} className="text-[#0D4F4F]" /> Artistic Overlay</h3>
            <div className="space-y-3">
              <div>
                <label className="flex justify-between text-sm">Color</label>
                <input type="color" value={overlayColor} onChange={e => setOverlayColor(e.target.value)} className="w-full h-10 border rounded" />
              </div>
              <div>
                <label className="flex justify-between text-sm">Opacity <span>{Math.round(overlayOpacity * 100)}%</span></label>
                <input type="range" min="0" max="1" step="0.05" value={overlayOpacity} onChange={e => setOverlayOpacity(parseFloat(e.target.value))} className="w-full accent-[#0D4F4F]" />
              </div>
            </div>
          </div>

          {/* Event Name */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Type size={18} className="text-[#0D4F4F]" /> Event Name</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showEventName} onChange={e => setShowEventName(e.target.checked)} /> Show</label>
            </div>
            {showEventName && (
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm">Preview text</label>
                  <input type="text" value={previewEventName} onChange={e => setPreviewEventName(e.target.value)} placeholder="Type custom preview text" className="w-full p-1 border rounded text-sm" />
                  <button onClick={() => setPreviewEventName(event?.name || '')} className="text-xs text-[#0D4F4F] hover:underline mt-1">Reset to event name</button>
                </div>
                <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(eventNameX)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_H.map(a => (
                      <button key={a.label} onClick={() => setEventNameX(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={eventNameX} onChange={e => setEventNameX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(eventNameY)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_V.map(a => (
                      <button key={a.label} onClick={() => setEventNameY(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={eventNameY} onChange={e => setEventNameY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Size <span>{eventNameSize}px</span></label>
                  <input type="range" min="12" max="60" value={eventNameSize} onChange={e => setEventNameSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Color</label>
                  <input type="color" value={eventNameColor} onChange={e => setEventNameColor(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Font</label>
                  <select value={eventNameFont} onChange={e => setEventNameFont(e.target.value)} className="w-full p-1 border rounded text-sm">
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Type size={18} className="text-[#0D4F4F]" /> Date & Time</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDate} onChange={e => setShowDate(e.target.checked)} /> Show</label>
            </div>
            {showDate && (
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm">Preview text</label>
                  <input type="text" value={previewDate} onChange={e => setPreviewDate(e.target.value)} placeholder="Type custom preview text" className="w-full p-1 border rounded text-sm" />
                  <button onClick={() => setPreviewDate(event?.date ? formatDate(event.date) : '')} className="text-xs text-[#0D4F4F] hover:underline mt-1">Reset to event date</button>
                </div>
                <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(dateX)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_H.map(a => (
                      <button key={a.label} onClick={() => setDateX(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={dateX} onChange={e => setDateX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(dateY)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_V.map(a => (
                      <button key={a.label} onClick={() => setDateY(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={dateY} onChange={e => setDateY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Size <span>{dateSize}px</span></label>
                  <input type="range" min="12" max="48" value={dateSize} onChange={e => setDateSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Color</label>
                  <input type="color" value={dateColor} onChange={e => setDateColor(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Font</label>
                  <select value={dateFont} onChange={e => setDateFont(e.target.value)} className="w-full p-1 border rounded text-sm">
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Venue */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Type size={18} className="text-[#0D4F4F]" /> Venue</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showVenue} onChange={e => setShowVenue(e.target.checked)} /> Show</label>
            </div>
            {showVenue && (
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm">Preview text</label>
                  <input type="text" value={previewVenue} onChange={e => setPreviewVenue(e.target.value)} placeholder="Type custom preview text" className="w-full p-1 border rounded text-sm" />
                  <button onClick={() => setPreviewVenue(event?.venue || '')} className="text-xs text-[#0D4F4F] hover:underline mt-1">Reset to event venue</button>
                </div>
                <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(venueX)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_H.map(a => (
                      <button key={a.label} onClick={() => setVenueX(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={venueX} onChange={e => setVenueX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(venueY)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_V.map(a => (
                      <button key={a.label} onClick={() => setVenueY(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={venueY} onChange={e => setVenueY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Size <span>{venueSize}px</span></label>
                  <input type="range" min="12" max="48" value={venueSize} onChange={e => setVenueSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Color</label>
                  <input type="color" value={venueColor} onChange={e => setVenueColor(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Font</label>
                  <select value={venueFont} onChange={e => setVenueFont(e.target.value)} className="w-full p-1 border rounded text-sm">
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Guest Name */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Type size={18} className="text-[#0D4F4F]" /> Guest Name</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeName} onChange={e => setIncludeName(e.target.checked)} /> Show</label>
            </div>
            {includeName && (
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm">Preview text</label>
                  <input type="text" value={previewGuestName} onChange={e => setPreviewGuestName(e.target.value)} placeholder="Type custom preview text" className="w-full p-1 border rounded text-sm" />
                </div>
                <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(nameX)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_H.map(a => (
                      <button key={a.label} onClick={() => setNameX(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={nameX} onChange={e => setNameX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(nameY)}%</span></label>
                  <div className="flex gap-1">
                    {ALIGN_V.map(a => (
                      <button key={a.label} onClick={() => setNameY(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                    ))}
                  </div>
                  <input type="range" min="0" max="100" value={nameY} onChange={e => setNameY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Size <span>{nameFontSize}px</span></label>
                  <input type="range" min="12" max="60" value={nameFontSize} onChange={e => setNameFontSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Color</label>
                  <input type="color" value={nameFontColor} onChange={e => setNameFontColor(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Font</label>
                  <select value={nameFont} onChange={e => setNameFont(e.target.value)} className="w-full p-1 border rounded text-sm">
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Move size={18} className="text-[#0D4F4F]" /> QR Code</h3>
            <div className="space-y-3">
              <div><label className="flex justify-between text-sm">Horizontal <span>{Math.round(qrX)}%</span></label>
                <div className="flex gap-1">
                  {ALIGN_H.map(a => (
                    <button key={a.label} onClick={() => setQrX(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                  ))}
                </div>
                <input type="range" min="0" max="100" value={qrX} onChange={e => setQrX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
              </div>
              <div><label className="flex justify-between text-sm">Vertical <span>{Math.round(qrY)}%</span></label>
                <div className="flex gap-1">
                  {ALIGN_V.map(a => (
                    <button key={a.label} onClick={() => setQrY(a.value)} className="p-1 border rounded text-xs flex-1">{a.label}</button>
                  ))}
                </div>
                <input type="range" min="0" max="100" value={qrY} onChange={e => setQrY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
              </div>
              <div><label className="flex justify-between text-sm">Size <span>{qrSize}px</span></label><input type="range" min="80" max="300" step="10" value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" /></div>
              <div><label className="flex justify-between text-sm">Color</label><input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)} className="w-full" /></div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !templateUrl}
            className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}