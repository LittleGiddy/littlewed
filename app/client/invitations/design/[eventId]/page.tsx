'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload, Save, Loader2, Image as ImageIcon, Trash2, Check, Type, Palette,
  AlignLeft, AlignCenter, AlignRight, Square, Minus, Plus, Copy, ArrowUp, ArrowDown, 
  Layers, Eye, EyeOff, Undo, Redo, Lock, Unlock, Grid, ChevronDown, ChevronRight,
  Settings, QrCode, User, Users, UserCheck, Hash, Sparkles, RotateCw,
  X, Maximize, Minimize, ArrowLeft, Zap, Sliders, PanelRight, PanelLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Constants ──────────────────────────────────────────────────────────
const DESIGNER_WIDTH = 800;
const DESIGNER_HEIGHT = 1200;
// Preview scale - the card is displayed at 1/3 size
const PREVIEW_SCALE = 1 / 3;

// ─── Generate unique IDs ────────────────────────────────────────────────
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const FONTS = [
  'Playfair Display', 'DM Sans', 'Roboto', 'Lora', 'Montserrat',
  'Georgia', 'Open Sans', 'Raleway', 'Nunito', 'Poppins',
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script'
];

const ALIGN_H = [
  { label: <AlignLeft size={14} />, value: 'left' },
  { label: <AlignCenter size={14} />, value: 'center' },
  { label: <AlignRight size={14} />, value: 'right' },
];

// ─── Layer creators ──────────────────────────────────────────────────────
const createTextLayer = (text = 'New Text', x = 50, y = 50, isGuestName = false, isGuestType = false, isCardNumber = false) => ({
  id: generateId(),
  type: 'text',
  x, y, rotation: 0,
  text, fontSize: 24, fontFamily: 'Playfair Display',
  color: '#ffffff', align: 'center',
  shadow: { color: 'rgba(0,0,0,0.3)', blur: 4, offsetX: 0, offsetY: 2 },
  visible: true, locked: false,
  isGuestName,
  isGuestType,
  isCardNumber,
});

const createRectLayer = (x = 30, y = 30, w = 40, h = 20) => ({
  id: generateId(),
  type: 'rect',
  x, y, rotation: 0, width: w, height: h,
  fill: 'rgba(255,255,255,0.2)',
  borderColor: '#ffffff', borderWidth: 2,
  shadow: { color: 'rgba(0,0,0,0.1)', blur: 2, offsetX: 0, offsetY: 0 },
  visible: true, locked: false,
});

const createLineLayer = (x1 = 10, y1 = 50, x2 = 90, y2 = 50) => ({
  id: generateId(),
  type: 'line',
  x: 50, y: 50, rotation: 0,
  startX: x1, startY: y1, endX: x2, endY: y2,
  strokeColor: '#ffffff', strokeWidth: 2,
  shadow: { color: 'rgba(0,0,0,0.1)', blur: 2, offsetX: 0, offsetY: 0 },
  dashArray: 'solid', arrowStart: 'none', arrowEnd: 'none',
  visible: true, locked: false,
});

export default function InvitationDesigner() {
  const { eventId } = useParams();
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [overlayColor, setOverlayColor] = useState('#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(0.2);
  const [qrX, setQrX] = useState(85);
  const [qrY, setQrY] = useState(85);
  const [qrSize, setQrSize] = useState(150);
  const [qrColor, setQrColor] = useState('#0D4F4F');
  const [qrRotation, setQrRotation] = useState(0);
  const [layers, setLayers] = useState<any[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY = 30;
  const [showGrid, setShowGrid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'layers' | 'properties' | 'settings'>('layers');
  const [showPanel, setShowPanel] = useState(true);

  // ─── Debounce timer for history ──────────────────────────────────────
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{ type: string; index: number; point?: 'start' | 'end' } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState<{ index: number; type: string } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, initialSize: 0, initialWidth: 0, initialHeight: 0, initialFontSize: 0 });

  // ─── Canvas scaling ───────────────────────────────────────────────────
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const computeScale = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (containerWidth <= 0 || containerHeight <= 0) return;
      
      // ✅ Preview is displayed at 1/3 of the actual size
      // The canvas is 800x1200, but we want it to fit nicely on screen
      const scaleX = containerWidth / DESIGNER_WIDTH;
      const scaleY = containerHeight / DESIGNER_HEIGHT;
      const scale = Math.min(scaleX, scaleY, 0.5);
      setCanvasScale(scale);
    };

    computeScale();
    const ro = new ResizeObserver(computeScale);
    ro.observe(container);
    window.addEventListener('resize', computeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeScale);
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── History helpers ──────────────────────────────────────────────────
  const pushHistory = useCallback((newLayers: any[]) => {
    const snapshot = JSON.parse(JSON.stringify(newLayers));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setLayers(JSON.parse(JSON.stringify(history[idx])));
      setHistoryIndex(idx);
      setSelectedLayerIndex(null);
      toast.success('Undo');
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setLayers(JSON.parse(JSON.stringify(history[idx])));
      setHistoryIndex(idx);
      setSelectedLayerIndex(null);
      toast.success('Redo');
    }
  }, [historyIndex, history]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' && selectedLayerIndex !== null) {
        deleteLayer(selectedLayerIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedLayerIndex]);

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

        let initialLayers = [];
        if (settings.designLayers && Array.isArray(settings.designLayers)) {
          initialLayers = settings.designLayers;
        } else {
          initialLayers = [
            createTextLayer('Welcome to our Wedding', 50, 18),
            createTextLayer('You are cordially invited', 50, 32),
            createTextLayer('Date: June 30, 2026', 50, 42),
            createTextLayer('Venue: The Grand Hall', 50, 50),
          ];
        }
        setLayers(initialLayers);
        const snapshot = JSON.parse(JSON.stringify(initialLayers));
        setHistory([snapshot]);
        setHistoryIndex(0);

        setOverlayColor(settings.overlayColor ?? '#000000');
        setOverlayOpacity(settings.overlayOpacity ?? 0.2);
        setQrX(settings.qrPlacementX ?? 85);
        setQrY(settings.qrPlacementY ?? 85);
        setQrSize(settings.qrSize ?? 150);
        setQrColor(settings.qrColor ?? '#0D4F4F');
        setQrRotation(settings.qrRotation ?? 0);
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
    
    const MAX_FILE_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 3MB limit');
      e.target.value = '';
      return;
    }

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
        toast.success('Background uploaded successfully');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Network error');
    }
    setUploading(false);
    e.target.value = '';
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
          qrRotation,
          designLayers: layers,
        }),
      });
      if (res.ok) {
        toast.success('Design saved successfully!');
        setShowSuccessModal(true);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Network error');
    }
    setSaving(false);
  };

  // ─── Layer operations ──────────────────────────────────────────────────
  const setLayersWithHistory = (newLayers: any[], recordHistory = true) => {
    setLayers(newLayers);
    if (recordHistory) {
      pushHistory(newLayers);
    }
  };

  const scheduleHistory = useCallback((newLayers: any[]) => {
    setLayers(newLayers);
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    historyTimeoutRef.current = setTimeout(() => {
      pushHistory(newLayers);
      historyTimeoutRef.current = null;
    }, 300);
  }, [pushHistory]);

  const addTextLayer = () => {
    const newLayer = createTextLayer('New Text', 50, 50);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };

  const addGuestNameLayer = () => {
    const newLayer = createTextLayer('{guestName}', 50, 60, true, false, false);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
    toast.success('Guest name layer added');
  };

  const addGuestTitleLayer = () => {
    const newLayer = createTextLayer('{guestTitle}', 50, 55, false, true, false);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
    toast.success('Guest title layer added');
  };

  const addGuestTypeLayer = () => {
    const newLayer = createTextLayer('{guestType}', 50, 58, false, true, false);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
    toast.success('Guest type layer added');
  };

  const addCardNumberLayer = () => {
    const newLayer = createTextLayer('{cardNumber}', 50, 65, false, false, true);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
    toast.success('Card number layer added');
  };

  const addRectLayer = () => {
    const newLayer = createRectLayer();
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };

  const addLineLayer = () => {
    const newLayer = createLineLayer();
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };

  const deleteLayer = (index: number) => {
    if (layers[index]?.locked) {
      toast.error('Layer is locked');
      return;
    }
    const newLayers = [...layers];
    newLayers.splice(index, 1);
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(null);
  };

  const duplicateLayer = (index: number) => {
    const layer = layers[index];
    const newLayer = { ...layer, id: generateId() };
    if (newLayer.type === 'text') newLayer.text = `${newLayer.text} (copy)`;
    const newLayers = [...layers];
    newLayers.splice(index + 1, 0, newLayer);
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(index + 1);
  };

  const moveLayerUp = (index: number) => {
    if (index === 0) return;
    const newLayers = [...layers];
    [newLayers[index - 1], newLayers[index]] = [newLayers[index], newLayers[index - 1]];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(index - 1);
  };

  const moveLayerDown = (index: number) => {
    if (index === layers.length - 1) return;
    const newLayers = [...layers];
    [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(index + 1);
  };

  const bringToFront = (index: number) => {
    const layer = layers[index];
    const newLayers = layers.filter((_, i) => i !== index);
    newLayers.push(layer);
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };

  const sendToBack = (index: number) => {
    const layer = layers[index];
    const newLayers = layers.filter((_, i) => i !== index);
    newLayers.unshift(layer);
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(0);
  };

  const toggleLayerVisibility = (index: number) => {
    const layer = layers[index];
    const newLayers = [...layers];
    newLayers[index] = { ...layer, visible: !layer.visible };
    setLayersWithHistory(newLayers);
  };

  const toggleLayerLock = (index: number) => {
    const layer = layers[index];
    const newLayers = [...layers];
    newLayers[index] = { ...layer, locked: !layer.locked };
    setLayersWithHistory(newLayers);
  };

  const updateLayer = (index: number, updates: any) => {
    const newLayers = [...layers];
    newLayers[index] = { ...newLayers[index], ...updates };
    scheduleHistory(newLayers);
  };

  // ─── Drag handlers ──────────────────────────────────────────────────
  const startDrag = (index: number) => (e: React.MouseEvent | React.TouchEvent) => {
    if (layers[index]?.locked) return;
    if (!canvasRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    const layer = layers[index];
    const x = layer.x ?? 50;
    const y = layer.y ?? 50;
    setDragOffset({
      x: clientX - rect.left - (x / 100) * rect.width,
      y: clientY - rect.top - (y / 100) * rect.height,
    });
    setDragging({ type: 'layer', index });
    e.preventDefault();
  };

  const startDragLinePoint = (index: number, point: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
    if (layers[index]?.locked) return;
    e.stopPropagation();
    setDragging({ type: 'linePoint', index, point });
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

    if (dragging.type === 'qr') {
      setQrX(newX);
      setQrY(newY);
      e.preventDefault();
      return;
    }

    const idx = dragging.index;
    const layer = layers[idx];
    if (!layer) return;

    if (dragging.type === 'linePoint') {
      const point = dragging.point;
      if (point === 'start') {
        updateLayer(idx, { startX: newX, startY: newY });
      } else {
        updateLayer(idx, { endX: newX, endY: newY });
      }
      e.preventDefault();
      return;
    }

    if (layer.type === 'line') {
      const deltaX = newX - (layer.x ?? 50);
      const deltaY = newY - (layer.y ?? 50);
      updateLayer(idx, {
        x: newX,
        y: newY,
        startX: Math.min(Math.max(0, (layer.startX ?? 10) + deltaX), 100),
        startY: Math.min(Math.max(0, (layer.startY ?? 50) + deltaY), 100),
        endX: Math.min(Math.max(0, (layer.endX ?? 90) + deltaX), 100),
        endY: Math.min(Math.max(0, (layer.endY ?? 50) + deltaY), 100),
      });
    } else {
      updateLayer(idx, { x: newX, y: newY });
    }
    e.preventDefault();
  };

  const endDrag = () => setDragging(null);

  // ─── Resize handlers ──────────────────────────────────────────────────
  const startResize = (index: number) => (e: React.MouseEvent | React.TouchEvent) => {
    if (layers[index]?.locked) return;
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const layer = layers[index];
    const initialFontSize = layer.type === 'text' ? layer.fontSize : 0;
    const initialWidth = layer.type === 'rect' ? layer.width : 0;
    const initialHeight = layer.type === 'rect' ? layer.height : 0;
    setResizeStart({
      x: clientX,
      y: clientY,
      initialSize: initialFontSize,
      initialWidth,
      initialHeight,
      initialFontSize,
    });
    setResizing({ index, type: layer.type });
    e.preventDefault();
  };

  const moveResize = (e: React.MouseEvent | React.TouchEvent) => {
    if (!resizing) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - resizeStart.y;
    const idx = resizing.index;
    const layer = layers[idx];
    if (layer.type === 'text') {
      const newSize = Math.max(8, resizeStart.initialFontSize + deltaY * 0.5);
      updateLayer(idx, { fontSize: Math.round(newSize) });
    } else if (layer.type === 'rect') {
      const deltaX = clientX - resizeStart.x;
      const newWidth = Math.max(5, resizeStart.initialWidth + deltaX * 0.2);
      const newHeight = Math.max(5, resizeStart.initialHeight + deltaY * 0.2);
      updateLayer(idx, {
        width: Math.round(Math.min(100, newWidth)),
        height: Math.round(Math.min(100, newHeight)),
      });
    }
    e.preventDefault();
  };

  const endResize = () => setResizing(null);

  // ─── Render layer ─────────────────────────────────────────────────────
  const renderLayer = (layer: any, index: number) => {
    if (!layer.visible) return null;
    const isSelected = index === selectedLayerIndex;
    const isLocked = layer.locked;
    const commonStyle: any = {
      position: 'absolute' as const,
      pointerEvents: 'auto' as const,
      touchAction: 'none' as const,
      border: isSelected && !isLocked ? '2px solid #0D4F4F' : 'none',
      borderRadius: '2px',
      opacity: isLocked ? 0.6 : 1,
    };

    if (layer.type === 'text') {
      const shadow = layer.shadow
        ? `${layer.shadow.offsetX || 0}px ${layer.shadow.offsetY || 0}px ${layer.shadow.blur || 0}px ${layer.shadow.color || 'rgba(0,0,0,0.3)'}`
        : 'none';
      
      // ✅ CRITICAL: Multiply font size by 3 for preview readability
      // The preview is at 1/3 scale, so 24px becomes 8px - too small!
      // We multiply by 3 to make it readable (24px * 3 = 72px in preview)
      // But we need to adjust based on the actual canvas scale
      const previewScaleFactor = Math.max(1 / canvasScale, 1);
      const displayFontSize = layer.fontSize * Math.min(previewScaleFactor, 3);
      
      return (
        <div
          key={layer.id}
          className="select-none"
          style={{
            ...commonStyle,
            cursor: isLocked ? 'default' : 'move',
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
            fontSize: `${displayFontSize}px`,
            fontFamily: layer.fontFamily,
            color: layer.color,
            textAlign: layer.align || 'center',
            textShadow: shadow,
            width: '80%',
            fontWeight: 'bold',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.4,
          }}
          onMouseDown={isLocked ? undefined : startDrag(index)}
          onTouchStart={isLocked ? undefined : startDrag(index)}
          onClick={() => setSelectedLayerIndex(index)}
        >
          {layer.text || ' '}
          {isSelected && !isLocked && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-[#0D4F4F] rounded cursor-nw-resize"
              style={{ transform: 'translate(50%, 50%)' }}
              onMouseDown={startResize(index)}
              onTouchStart={startResize(index)}
            />
          )}
        </div>
      );
    }

    if (layer.type === 'rect') {
      const shadow = layer.shadow
        ? `${layer.shadow.offsetX || 0}px ${layer.shadow.offsetY || 0}px ${layer.shadow.blur || 0}px ${layer.shadow.color || 'rgba(0,0,0,0.1)'}`
        : 'none';
      return (
        <div
          key={layer.id}
          style={{
            ...commonStyle,
            cursor: isLocked ? 'default' : 'move',
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
            width: `${layer.width}%`,
            height: `${layer.height}%`,
            backgroundColor: layer.fill || 'rgba(255,255,255,0.2)',
            border: `${layer.borderWidth || 0}px solid ${layer.borderColor || 'transparent'}`,
            boxShadow: shadow,
            borderRadius: '4px',
          }}
          onMouseDown={isLocked ? undefined : startDrag(index)}
          onTouchStart={isLocked ? undefined : startDrag(index)}
          onClick={() => setSelectedLayerIndex(index)}
        >
          {isSelected && !isLocked && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-[#0D4F4F] rounded cursor-nw-resize"
              style={{ transform: 'translate(50%, 50%)' }}
              onMouseDown={startResize(index)}
              onTouchStart={startResize(index)}
            />
          )}
        </div>
      );
    }

    if (layer.type === 'line') {
      const x1 = layer.startX ?? 10;
      const y1 = layer.startY ?? 50;
      const x2 = layer.endX ?? 90;
      const y2 = layer.endY ?? 50;
      const dash = layer.dashArray === 'dashed' ? '5,5' : layer.dashArray === 'dotted' ? '2,4' : '';
      const shadow = layer.shadow
        ? `drop-shadow(${layer.shadow.offsetX || 0}px ${layer.shadow.offsetY || 0}px ${layer.shadow.blur || 0}px ${layer.shadow.color || 'rgba(0,0,0,0.1)'})`
        : 'none';

      const isDraggable = !isLocked;
      return (
        <svg
          key={layer.id}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <line
            x1={`${x1}%`}
            y1={`${y1}%`}
            x2={`${x2}%`}
            y2={`${y2}%`}
            stroke={layer.strokeColor || '#ffffff'}
            strokeWidth={layer.strokeWidth || 2}
            strokeLinecap="round"
            strokeDasharray={dash}
            style={{ filter: shadow }}
          />
          {isSelected && (
            <>
              <circle
                cx={`${x1}%`}
                cy={`${y1}%`}
                r="8"
                fill="#0D4F4F"
                className={isDraggable ? 'pointer-events-auto cursor-grab' : 'pointer-events-none'}
                onMouseDown={isDraggable ? startDragLinePoint(index, 'start') : undefined}
                onTouchStart={isDraggable ? startDragLinePoint(index, 'start') : undefined}
              />
              <circle
                cx={`${x2}%`}
                cy={`${y2}%`}
                r="8"
                fill="#0D4F4F"
                className={isDraggable ? 'pointer-events-auto cursor-grab' : 'pointer-events-none'}
                onMouseDown={isDraggable ? startDragLinePoint(index, 'end') : undefined}
                onTouchStart={isDraggable ? startDragLinePoint(index, 'end') : undefined}
              />
            </>
          )}
          <circle
            cx={`${(x1 + x2) / 2}%`}
            cy={`${(y1 + y2) / 2}%`}
            r={isLocked ? '0' : '12'}
            fill="transparent"
            className={isDraggable ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}
            onMouseDown={isDraggable ? startDrag(index) : undefined}
            onTouchStart={isDraggable ? startDrag(index) : undefined}
            onClick={() => setSelectedLayerIndex(index)}
          />
        </svg>
      );
    }
    return null;
  };

  // ─── Range Slider Component ──────────────────────────────────────────
  const RangeSlider = ({ 
    value, 
    onChange, 
    min, 
    max, 
    step = 1, 
    label, 
    suffix = '',
    icon: Icon,
    showInput = false
  }: any) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-gray-600 flex items-center gap-1.5">
          {Icon && <Icon size={12} className="text-[#0D4F4F]" />}
          {label}
        </label>
        <span className="text-[10px] font-semibold text-[#0D4F4F] bg-[#0D4F4F]/10 px-2 py-0.5 rounded">
          {value}{suffix}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0D4F4F] transition-all hover:h-2"
          style={{
            background: `linear-gradient(to right, #0D4F4F 0%, #0D4F4F ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`
          }}
        />
        {showInput && (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
            min={min}
            max={max}
          />
        )}
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4F4F]" />
        <p className="text-sm text-gray-400">Loading designer...</p>
      </div>
    );
  }

  const selectedLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─── Top Navigation Bar ─── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm flex-shrink-0">
        <div className="px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push(`/client/events/${eventId}`)}
              className="p-1.5 text-gray-500 hover:text-[#0D4F4F] rounded-lg hover:bg-gray-100 transition flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="font-serif text-sm sm:text-base font-black text-gray-900 truncate">Designer</h1>
              <p className="text-[8px] sm:text-[10px] text-gray-500 truncate hidden xs:block">{event?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-lg transition ${showGrid ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="Toggle grid"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition"
              title="Undo"
            >
              <Undo size={16} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition"
              title="Redo"
            >
              <Redo size={16} />
            </button>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition hidden lg:flex"
              title={showPanel ? 'Hide panel' : 'Show panel'}
            >
              {showPanel ? <PanelRight size={16} /> : <PanelLeft size={16} />}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !templateUrl}
              className="px-3 sm:px-4 py-1.5 bg-[#0D4F4F] text-white rounded-lg text-xs font-semibold hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Preview Area ─── */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden">
          {/* Template selector */}
          <div className="flex items-center gap-2 mb-3 flex-shrink-0 overflow-x-auto pb-1">
            <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">Template:</span>
            <div className="flex gap-1.5">
              {templates.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition hover:shadow-md ${
                    selectedTemplateId === t.id ? 'border-[#0D4F4F] shadow-md' : 'border-transparent'
                  }`}
                >
                  <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="flex-shrink-0 w-10 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#0D4F4F] transition">
                <Upload size={14} className="text-gray-400" />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" ref={fileInputRef} />
              </label>
              {uploading && <Loader2 size={14} className="animate-spin text-[#0D4F4F] flex-shrink-0" />}
              {templateUrl && (
                <button
                  onClick={() => { setTemplateUrl(null); setSelectedTemplateId(null); }}
                  className="flex-shrink-0 text-red-500 hover:text-red-700 transition p-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Card Preview - takes up most of the space */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div 
              ref={canvasContainerRef}
              className="w-full h-full max-w-[700px] max-h-[85vh] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative"
            >
              <div
                ref={canvasRef}
                className="absolute top-1/2 left-1/2 origin-center"
                style={{
                  width: DESIGNER_WIDTH,
                  height: DESIGNER_HEIGHT,
                  transform: `translate(-50%, -50%) scale(${canvasScale})`,
                  transformOrigin: 'center center',
                }}
              >
                {templateUrl ? (
                  <>
                    <img src={templateUrl} alt="Card preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 pointer-events-none" style={{ 
                      backgroundColor: overlayColor, 
                      opacity: overlayOpacity 
                    }} />

                    {layers.map((layer, idx) => renderLayer(layer, idx))}

                    {/* QR Code */}
                    <div
                      className="absolute flex items-center justify-center cursor-move touch-none select-none pointer-events-auto"
                      style={{
                        left: `${qrX}%`,
                        top: `${qrY}%`,
                        width: Math.min(qrSize, 300),
                        height: Math.min(qrSize, 300),
                        transform: `translate(-50%, -50%) rotate(${qrRotation}deg)`,
                        zIndex: 20,
                      }}
                      onMouseDown={(e) => {
                        const rect = canvasRef.current!.getBoundingClientRect();
                        const clientX = e.clientX;
                        const clientY = e.clientY;
                        setDragOffset({
                          x: clientX - rect.left - (qrX / 100) * rect.width,
                          y: clientY - rect.top - (qrY / 100) * rect.height,
                        });
                        setDragging({ type: 'qr', index: -1 });
                        e.preventDefault();
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const rect = canvasRef.current!.getBoundingClientRect();
                        setDragOffset({
                          x: touch.clientX - rect.left - (qrX / 100) * rect.width,
                          y: touch.clientY - rect.top - (qrY / 100) * rect.height,
                        });
                        setDragging({ type: 'qr', index: -1 });
                        e.preventDefault();
                      }}
                    >
                      <div 
                        className="w-full h-full rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.85)',
                          backdropFilter: 'blur(2px)',
                          border: `2px dashed ${qrColor === '#000000' ? '#0D4F4F' : qrColor}`,
                          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                        }}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 relative z-10">
                          <QrCode 
                            size={Math.min(Math.max(qrSize * 0.5, 28), 72)} 
                            style={{ color: qrColor === '#000000' ? '#0D4F4F' : qrColor }}
                            className="drop-shadow-sm"
                          />
                          <span className="text-[7px] font-mono tracking-wider opacity-60" style={{ color: qrColor }}>
                            SCAN ME
                          </span>
                        </div>
                        <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-l-2 border-t-2 opacity-30" style={{ borderColor: qrColor }} />
                        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-r-2 border-t-2 opacity-30" style={{ borderColor: qrColor }} />
                        <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-l-2 border-b-2 opacity-30" style={{ borderColor: qrColor }} />
                        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-r-2 border-b-2 opacity-30" style={{ borderColor: qrColor }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center p-4">
                      <ImageIcon size={40} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No template selected</p>
                      <p className="text-xs">Upload or choose a template above</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-[9px] text-gray-400 text-center mt-2 flex-shrink-0">
            Click a layer to edit · Drag to reposition · {layers.length} layers
          </p>
        </div>

        {/* ─── Controls Panel ─── */}
        {showPanel && (
          <div className="w-full sm:w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            {/* Quick Add */}
            <div className="p-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Zap size={12} className="text-[#0D4F4F]" /> Quick Add
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={addGuestNameLayer} className="bg-[#0D4F4F] text-white px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1">
                  <User size={11} /> Name
                </button>
                <button onClick={addGuestTitleLayer} className="bg-[#0D4F4F] text-white px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1">
                  <UserCheck size={11} /> Title
                </button>
                <button onClick={addGuestTypeLayer} className="bg-[#0D4F4F] text-white px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1">
                  <Users size={11} /> Type
                </button>
                <button onClick={addCardNumberLayer} className="bg-[#0D4F4F] text-white px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1">
                  <Hash size={11} /> Card
                </button>
                <button onClick={addTextLayer} className="col-span-2 bg-gray-200 text-gray-700 px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1">
                  <Type size={11} /> Custom Text
                </button>
                <button onClick={addRectLayer} className="col-span-1 bg-gray-200 text-gray-700 px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1">
                  <Square size={11} /> Rect
                </button>
                <button onClick={addLineLayer} className="col-span-1 bg-gray-200 text-gray-700 px-1 py-1.5 rounded-lg text-[9px] font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1">
                  <Minus size={11} /> Line
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex border-b border-gray-100 flex-shrink-0">
                {[
                  { id: 'layers', label: 'Layers', icon: Layers },
                  { id: 'properties', label: 'Properties', icon: Settings },
                  { id: 'settings', label: 'Settings', icon: Sliders },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 text-[10px] font-semibold transition flex items-center justify-center gap-1 ${
                      activeTab === tab.id
                        ? 'text-[#0D4F4F] border-b-2 border-[#0D4F4F] bg-[#0D4F4F]/5'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {/* ─── Layers Tab ─── */}
                {activeTab === 'layers' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500">{layers.length} layers</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            if (selectedLayerIndex !== null) bringToFront(selectedLayerIndex);
                            else toast.error('Select a layer first');
                          }} 
                          className="p-1 hover:bg-gray-100 rounded text-[10px] text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed" 
                          title="Bring to Front"
                          disabled={selectedLayerIndex === null}
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button 
                          onClick={() => {
                            if (selectedLayerIndex !== null) sendToBack(selectedLayerIndex);
                            else toast.error('Select a layer first');
                          }} 
                          className="p-1 hover:bg-gray-100 rounded text-[10px] text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed" 
                          title="Send to Back"
                          disabled={selectedLayerIndex === null}
                        >
                          <ArrowDown size={10} />
                        </button>
                      </div>
                    </div>
                    {layers.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        <Layers size={18} className="mx-auto mb-1 opacity-30" />
                        No layers yet
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {layers.map((layer, idx) => (
                          <div
                            key={layer.id}
                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer hover:bg-gray-50 transition ${
                              idx === selectedLayerIndex ? 'bg-[#0D4F4F]/10 border-l-3 border-[#0D4F4F]' : ''
                            }`}
                            onClick={() => setSelectedLayerIndex(idx)}
                          >
                            <span className="text-[10px] truncate flex items-center gap-1.5 max-w-[100px]">
                              {layer.type === 'text' && <Type size={9} />}
                              {layer.type === 'rect' && <Square size={9} />}
                              {layer.type === 'line' && <Minus size={9} />}
                              {layer.isGuestName && <User size={9} className="text-[#0D4F4F]" />}
                              {layer.isGuestType && <UserCheck size={9} className="text-[#0D4F4F]" />}
                              {layer.isCardNumber && <Hash size={9} className="text-[#0D4F4F]" />}
                              <span className="truncate">
                                {layer.type === 'text' 
                                  ? (layer.text || 'Text').substring(0, 10) 
                                  : layer.type === 'rect' ? 'Rect' : 'Line'}
                              </span>
                            </span>
                            <div className="flex gap-0.5 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Toggle">
                                {layer.visible ? <Eye size={9} /> : <EyeOff size={9} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Lock">
                                {layer.locked ? <Lock size={9} /> : <Unlock size={9} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); duplicateLayer(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Duplicate">
                                <Copy size={9} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); moveLayerUp(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Up">
                                <ArrowUp size={9} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); moveLayerDown(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Down">
                                <ArrowDown size={9} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteLayer(idx); }} className="p-1 hover:bg-red-100 rounded text-red-500" title="Delete">
                                <Trash2 size={9} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Properties Tab ─── */}
                {activeTab === 'properties' && (
                  <div>
                    {selectedLayer ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <RangeSlider
                            label="X"
                            value={Math.round(selectedLayer.x || 50)}
                            onChange={(v: number) => updateLayer(selectedLayerIndex!, { x: v })}
                            min={0}
                            max={100}
                            suffix="%"
                            showInput
                          />
                          <RangeSlider
                            label="Y"
                            value={Math.round(selectedLayer.y || 50)}
                            onChange={(v: number) => updateLayer(selectedLayerIndex!, { y: v })}
                            min={0}
                            max={100}
                            suffix="%"
                            showInput
                          />
                        </div>

                        {selectedLayer.type === 'text' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Text</label>
                              <textarea
                                className="w-full p-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                                rows={2}
                                value={selectedLayer.text}
                                onChange={e => updateLayer(selectedLayerIndex!, { text: e.target.value })}
                              />
                              {selectedLayer.isGuestName && (
                                <p className="text-[8px] text-[#0D4F4F] mt-0.5">→ Guest's name</p>
                              )}
                              {selectedLayer.isGuestType && (
                                <p className="text-[8px] text-[#0D4F4F] mt-0.5">→ Single/Double</p>
                              )}
                              {selectedLayer.isCardNumber && (
                                <p className="text-[8px] text-[#0D4F4F] mt-0.5">→ Card number</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Font</label>
                              <select
                                className="w-full p-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                                value={selectedLayer.fontFamily}
                                onChange={e => updateLayer(selectedLayerIndex!, { fontFamily: e.target.value })}
                              >
                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>

                            <RangeSlider
                              label="Size"
                              value={selectedLayer.fontSize}
                              onChange={(v: number) => updateLayer(selectedLayerIndex!, { fontSize: v })}
                              min={8}
                              max={100}
                              suffix="px"
                              showInput
                            />

                            <RangeSlider
                              label="Rotation"
                              value={selectedLayer.rotation || 0}
                              onChange={(v: number) => updateLayer(selectedLayerIndex!, { rotation: v })}
                              min={-180}
                              max={180}
                              suffix="°"
                              icon={RotateCw}
                              showInput
                            />

                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Color</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={selectedLayer.color}
                                  onChange={e => updateLayer(selectedLayerIndex!, { color: e.target.value })}
                                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                                />
                                <div className="flex gap-1 flex-1">
                                  {ALIGN_H.map((a) => (
                                    <button
                                      key={a.value}
                                      onClick={() => updateLayer(selectedLayerIndex!, { align: a.value })}
                                      className={`flex-1 p-1 rounded-lg border transition ${
                                        selectedLayer.align === a.value ? 'bg-[#0D4F4F] text-white border-[#0D4F4F]' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {a.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedLayer.shadow}
                                onChange={e => {
                                  if (e.target.checked) {
                                    updateLayer(selectedLayerIndex!, {
                                      shadow: { color: 'rgba(0,0,0,0.3)', blur: 4, offsetX: 0, offsetY: 2 }
                                    });
                                  } else {
                                    updateLayer(selectedLayerIndex!, { shadow: null });
                                  }
                                }}
                                className="accent-[#0D4F4F]"
                              />
                              Shadow
                            </label>
                          </>
                        )}

                        {selectedLayer.type === 'rect' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Fill</label>
                              <input
                                type="color"
                                value={selectedLayer.fill || '#ffffff'}
                                onChange={e => updateLayer(selectedLayerIndex!, { fill: e.target.value })}
                                className="w-full h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Border</label>
                              <input
                                type="color"
                                value={selectedLayer.borderColor || '#ffffff'}
                                onChange={e => updateLayer(selectedLayerIndex!, { borderColor: e.target.value })}
                                className="w-full h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                              />
                            </div>
                            <RangeSlider
                              label="Border Width"
                              value={selectedLayer.borderWidth || 0}
                              onChange={(v: number) => updateLayer(selectedLayerIndex!, { borderWidth: v })}
                              min={0}
                              max={10}
                              suffix="px"
                              showInput
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <RangeSlider
                                label="Width"
                                value={selectedLayer.width || 30}
                                onChange={(v: number) => updateLayer(selectedLayerIndex!, { width: v })}
                                min={5}
                                max={100}
                                suffix="%"
                                showInput
                              />
                              <RangeSlider
                                label="Height"
                                value={selectedLayer.height || 20}
                                onChange={(v: number) => updateLayer(selectedLayerIndex!, { height: v })}
                                min={5}
                                max={100}
                                suffix="%"
                                showInput
                              />
                            </div>
                            <RangeSlider
                              label="Rotation"
                              value={selectedLayer.rotation || 0}
                              onChange={(v: number) => updateLayer(selectedLayerIndex!, { rotation: v })}
                              min={-180}
                              max={180}
                              suffix="°"
                              icon={RotateCw}
                              showInput
                            />
                          </>
                        )}

                        {selectedLayer.type === 'line' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Stroke</label>
                              <input
                                type="color"
                                value={selectedLayer.strokeColor || '#ffffff'}
                                onChange={e => updateLayer(selectedLayerIndex!, { strokeColor: e.target.value })}
                                className="w-full h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                              />
                            </div>
                            <RangeSlider
                              label="Stroke Width"
                              value={selectedLayer.strokeWidth || 2}
                              onChange={(v: number) => updateLayer(selectedLayerIndex!, { strokeWidth: v })}
                              min={1}
                              max={10}
                              suffix="px"
                              showInput
                            />
                            <div>
                              <label className="block text-[10px] font-medium text-gray-600 mb-1">Dash</label>
                              <select
                                className="w-full p-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                                value={selectedLayer.dashArray || 'solid'}
                                onChange={e => updateLayer(selectedLayerIndex!, { dashArray: e.target.value })}
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        <Settings size={18} className="mx-auto mb-1 opacity-30" />
                        Select a layer to edit
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Settings Tab ─── */}
                {activeTab === 'settings' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-600 mb-1">Overlay</label>
                      <input
                        type="color"
                        value={overlayColor}
                        onChange={e => setOverlayColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                      />
                    </div>
                    <RangeSlider
                      label="Opacity"
                      value={Math.round(overlayOpacity * 100)}
                      onChange={(v: number) => setOverlayOpacity(v / 100)}
                      min={0}
                      max={100}
                      suffix="%"
                      icon={Palette}
                      showInput
                    />

                    <div className="border-t border-gray-100 pt-2.5 mt-2">
                      <p className="text-[10px] font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                        <QrCode size={12} className="text-[#0D4F4F]" /> QR Code
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <RangeSlider
                          label="X"
                          value={Math.round(qrX)}
                          onChange={(v: number) => setQrX(v)}
                          min={0}
                          max={100}
                          suffix="%"
                          showInput
                        />
                        <RangeSlider
                          label="Y"
                          value={Math.round(qrY)}
                          onChange={(v: number) => setQrY(v)}
                          min={0}
                          max={100}
                          suffix="%"
                          showInput
                        />
                      </div>
                      <RangeSlider
                        label="Size"
                        value={qrSize}
                        onChange={(v: number) => setQrSize(v)}
                        min={40}
                        max={300}
                        suffix="px"
                        showInput
                      />
                      <RangeSlider
                        label="Rotation"
                        value={qrRotation}
                        onChange={(v: number) => setQrRotation(v)}
                        min={-180}
                        max={180}
                        suffix="°"
                        icon={RotateCw}
                        showInput
                      />
                      <div>
                        <label className="block text-[10px] font-medium text-gray-600 mb-1">Color</label>
                        <input
                          type="color"
                          value={qrColor}
                          onChange={e => setQrColor(e.target.value)}
                          className="w-full h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                        />
                      </div>
                      <div className="flex gap-1 mt-1">
                        {[
                          { label: 'S', size: 80 },
                          { label: 'M', size: 150 },
                          { label: 'L', size: 200 },
                          { label: 'XL', size: 250 },
                        ].map(preset => (
                          <button
                            key={preset.label}
                            onClick={() => setQrSize(preset.size)}
                            className={`flex-1 py-1 rounded-lg text-[8px] font-semibold transition ${
                              qrSize === preset.size
                                ? 'bg-[#0D4F4F] text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Success Modal ─── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fadeInUp">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">Design Saved! 🎉</h2>
              <p className="text-gray-600 text-sm mb-6">
                Your invitation design has been saved successfully. Now it's time to generate personalized cards for your guests.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push(`/client/events/${eventId}`);
                  }}
                  className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  Go Generate Cards
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full text-gray-500 text-sm hover:text-gray-700 transition"
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}