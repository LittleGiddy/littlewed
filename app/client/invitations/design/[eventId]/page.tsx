'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload, Move, Maximize2, Save, Loader2, Image, Trash2, Check, Type, Palette,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Square, Minus, Plus, Copy, ArrowUp, ArrowDown, Layers, Eye, EyeOff, Undo, Redo,
  Lock, Unlock, BringToFront, SendToBack, Grid, ChevronDown, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Generate unique IDs ────────────────────────────────────────────────
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// ─── Google Fonts list ──────────────────────────────────────────────────
const FONTS = [
  'Playfair Display', 'DM Sans', 'Roboto', 'Lora', 'Montserrat',
  'Georgia', 'Open Sans', 'Raleway', 'Nunito', 'Poppins',
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script'
];

// ─── Icons for alignment ─────────────────────────────────────────────────
const ALIGN_H = [
  { label: <AlignLeft size={14} />, value: 0 },
  { label: <AlignCenter size={14} />, value: 50 },
  { label: <AlignRight size={14} />, value: 100 },
];
const ALIGN_V = [
  { label: <AlignStartVertical size={14} />, value: 0 },
  { label: <AlignCenterVertical size={14} />, value: 50 },
  { label: <AlignEndVertical size={14} />, value: 100 },
];

// ─── Layer creators ──────────────────────────────────────────────────────
const createTextLayer = (text = 'New Text', x = 50, y = 50) => ({
  id: generateId(),
  type: 'text',
  x, y, rotation: 0,
  text, fontSize: 24, fontFamily: 'Playfair Display',
  color: '#ffffff', align: 'center',
  shadow: { color: 'rgba(0,0,0,0.3)', blur: 4, offsetX: 0, offsetY: 2 },
  visible: true, locked: false,
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

  // QR
  const [qrX, setQrX] = useState(100);
  const [qrY, setQrY] = useState(100);
  const [qrSize, setQrSize] = useState(200);
  const [qrColor, setQrColor] = useState('#000000');

  // Layers
  const [layers, setLayers] = useState<any[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);

  // Undo/Redo
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY = 30;

  // UI state
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    addLayer: false,
    layers: false,
    properties: false,
    overlay: false,
    qr: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [event, setEvent] = useState<any>(null);

  // Drag state
  const [dragging, setDragging] = useState<{ type: string; index: number; point?: 'start' | 'end' } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState<{ index: number; type: string } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, initialSize: 0, initialWidth: 0, initialHeight: 0, initialFontSize: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
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
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
        setQrX(settings.qrPlacementX ?? 100);
        setQrY(settings.qrPlacementY ?? 100);
        setQrSize(settings.qrSize ?? 200);
        setQrColor(settings.qrColor ?? '#000000');
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
          designLayers: layers,
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

  // ─── Layer operations with history ──────────────────────────────────

  const setLayersWithHistory = (newLayers: any[]) => {
    setLayers(newLayers);
    pushHistory(newLayers);
  };

  const addTextLayer = () => {
    const newLayer = createTextLayer('New Text', 50, 50);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };

  const addGuestNameLayer = () => {
    const newLayer = createTextLayer('Guest Name', 50, 60);
    const newLayers = [...layers, newLayer];
    setLayersWithHistory(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
    toast.success('Guest name layer added!');
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
    const newLayers = [...layers];
    newLayers.splice(index, 1);
    setLayersWithHistory(newLayers);
    if (selectedLayerIndex === index) setSelectedLayerIndex(null);
    else if (selectedLayerIndex !== null && selectedLayerIndex > index) setSelectedLayerIndex(selectedLayerIndex - 1);
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
    setLayersWithHistory(newLayers);
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
    if (snapToGrid) {
      const gridSize = 5;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }
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
      const newStartX = (layer.startX ?? 10) + deltaX;
      const newStartY = (layer.startY ?? 50) + deltaY;
      const newEndX = (layer.endX ?? 90) + deltaX;
      const newEndY = (layer.endY ?? 50) + deltaY;
      updateLayer(idx, {
        x: newX,
        y: newY,
        startX: Math.min(Math.max(0, newStartX), 100),
        startY: Math.min(Math.max(0, newStartY), 100),
        endX: Math.min(Math.max(0, newEndX), 100),
        endY: Math.min(Math.max(0, newEndY), 100),
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
            fontSize: `${layer.fontSize}px`,
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

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;

  const selectedLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const Section = ({ title, section, children }: any) => {
    const isCollapsed = collapsedSections[section];
    return (
      <div className="border-b border-gray-100 last:border-0">
        <button
          onClick={() => toggleSection(section)}
          className="w-full flex items-center justify-between p-3 text-left font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          <span>{title}</span>
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {!isCollapsed && <div className="p-3 pt-0">{children}</div>}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-3xl font-black text-gray-900">Invitation Designer</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg ${showGrid ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100'}`}
            title="Toggle grid"
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-2 rounded-lg ${snapToGrid ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100'}`}
            title="Snap to grid"
          >
            <Grid size={18} />
          </button>
          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"><Undo size={18} /></button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"><Redo size={18} /></button>
        </div>
      </div>
      <p className="text-gray-500 mb-6">Design your card with text, shapes, and QR code. Drag to position, click to edit.</p>

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

      {/* Main Content: Preview + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
        {/* ─── Preview (sticky on mobile) ─── */}
        <div className="lg:col-span-4 sticky top-0 z-10 bg-white lg:static lg:bg-transparent lg:z-auto max-h-[50vh] lg:max-h-none overflow-hidden border-b lg:border-b-0 border-gray-200 shadow-sm lg:shadow-none">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Maximize2 size={18} className="text-[#0D4F4F]" /> Live Preview
            </h2>
            <div
              ref={canvasRef}
              className={`relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] max-h-[600px] mx-auto ${showGrid ? 'bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,rgba(0,0,0,0.05)_19px,rgba(0,0,0,0.05)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,rgba(0,0,0,0.05)_19px,rgba(0,0,0,0.05)_20px)]' : ''}`}
              onMouseUp={() => { endDrag(); endResize(); }}
              onMouseLeave={() => { endDrag(); endResize(); }}
              onTouchEnd={() => { endDrag(); endResize(); }}
              onTouchCancel={() => { endDrag(); endResize(); }}
              onMouseMove={(e) => { moveDrag(e); moveResize(e); }}
              onTouchMove={(e) => { moveDrag(e); moveResize(e); }}
            >
              {templateUrl ? (
                <>
                  <img src={templateUrl} alt="Card preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: overlayColor, opacity: overlayOpacity }} />

                  {layers.map((layer, idx) => renderLayer(layer, idx))}

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
                    QR
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center"><Image size={40} className="mx-auto mb-2" /><p>Select a template or upload your own</p></div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">Drag layers to reposition. Click a layer to edit properties.</p>
          </div>
        </div>

        {/* ─── Controls ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Add Guest Name (always visible) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex items-center justify-between">
            <span className="font-semibold text-sm">Guest Name</span>
            <button
              onClick={addGuestNameLayer}
              className="bg-[#0D4F4F] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition flex items-center gap-1"
            >
              <Plus size={14} /> Add Guest Name
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <Section title="➕ Add Layer" section="addLayer">
              <div className="flex flex-wrap gap-2">
                <button onClick={addTextLayer} className="flex-1 bg-[#0D4F4F] text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1"><Type size={14} /> Text</button>
                <button onClick={addRectLayer} className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1"><Square size={14} /> Rectangle</button>
                <button onClick={addLineLayer} className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1"><Minus size={14} /> Line</button>
              </div>
            </Section>

            <Section title="📋 Layers" section="layers">
              {layers.length === 0 && <p className="text-gray-400 text-sm">No layers. Add one!</p>}
              {layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 ${idx === selectedLayerIndex ? 'bg-[rgba(13,79,79,0.08)] border-l-4 border-[#0D4F4F]' : ''}`}
                  onClick={() => setSelectedLayerIndex(idx)}
                >
                  <span className="text-sm truncate">
                    {layer.type === 'text' ? `📝 ${layer.text.substring(0, 20)}` : layer.type === 'rect' ? '⬛ Rectangle' : '━ Line'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(idx); }} className="p-1 hover:bg-gray-200 rounded">
                      {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(idx); }} className="p-1 hover:bg-gray-200 rounded">
                      {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateLayer(idx); }} className="p-1 hover:bg-gray-200 rounded"><Copy size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayerUp(idx); }} className="p-1 hover:bg-gray-200 rounded"><ArrowUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayerDown(idx); }} className="p-1 hover:bg-gray-200 rounded"><ArrowDown size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); bringToFront(idx); }} className="p-1 hover:bg-gray-200 rounded"><BringToFront size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); sendToBack(idx); }} className="p-1 hover:bg-gray-200 rounded"><SendToBack size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(idx); }} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </Section>

            <Section title="⚙️ Properties" section="properties">
              {selectedLayer ? (
                <div className="space-y-3">
                  {selectedLayer.type === 'text' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium">Text</label>
                        <textarea
                          className="w-full p-1 border rounded text-sm"
                          rows={3}
                          value={selectedLayer.text}
                          onChange={e => updateLayer(selectedLayerIndex!, { text: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Font Family</label>
                        <select
                          className="w-full p-1 border rounded text-sm"
                          value={selectedLayer.fontFamily}
                          onChange={e => updateLayer(selectedLayerIndex!, { fontFamily: e.target.value })}
                        >
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Font Size</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="8" max="100" value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayerIndex!, { fontSize: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-16 p-1 border rounded text-sm" value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayerIndex!, { fontSize: Number(e.target.value) })} min="8" max="100" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Color</label>
                        <input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayerIndex!, { color: e.target.value })} className="w-full" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Alignment</label>
                        <div className="flex gap-1">
                          {['left', 'center', 'right'].map(a => (
                            <button
                              key={a}
                              onClick={() => updateLayer(selectedLayerIndex!, { align: a })}
                              className={`p-1 border rounded flex-1 ${selectedLayer.align === a ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100'}`}
                            >
                              {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Rotation (°)</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="-180" max="180" value={selectedLayer.rotation || 0} onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-16 p-1 border rounded text-sm" value={selectedLayer.rotation || 0} onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })} min="-180" max="180" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
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
                            />
                            Enable Shadow
                          </label>
                        </div>
                        {selectedLayer.shadow && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-xs">Color</label>
                              <input type="color" value={selectedLayer.shadow.color || '#000000'} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, color: e.target.value } })} className="w-full" />
                            </div>
                            <div>
                              <label className="text-xs">Blur</label>
                              <div className="flex gap-2 items-center">
                                <input type="range" min="0" max="20" value={selectedLayer.shadow.blur || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, blur: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" />
                                <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.shadow.blur || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, blur: Number(e.target.value) } })} min="0" max="20" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs">Offset X</label>
                              <div className="flex gap-2 items-center">
                                <input type="range" min="-10" max="10" value={selectedLayer.shadow.offsetX || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetX: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" />
                                <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.shadow.offsetX || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetX: Number(e.target.value) } })} min="-10" max="10" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs">Offset Y</label>
                              <div className="flex gap-2 items-center">
                                <input type="range" min="-10" max="10" value={selectedLayer.shadow.offsetY || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetY: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" />
                                <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.shadow.offsetY || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetY: Number(e.target.value) } })} min="-10" max="10" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Position</label>
                        <div className="flex gap-1">
                          {ALIGN_H.map(a => (
                            <button key={a.value} onClick={() => updateLayer(selectedLayerIndex!, { x: a.value })} className="p-1 border rounded flex-1">{a.label}</button>
                          ))}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {ALIGN_V.map(a => (
                            <button key={a.value} onClick={() => updateLayer(selectedLayerIndex!, { y: a.value })} className="p-1 border rounded flex-1">{a.label}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedLayer.type === 'rect' && (
                    <div className="space-y-3">
                      <div>
                        <label className="flex justify-between text-sm">Fill</label>
                        <input type="color" value={selectedLayer.fill || '#ffffff'} onChange={e => updateLayer(selectedLayerIndex!, { fill: e.target.value })} className="w-full" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Border Color</label>
                        <input type="color" value={selectedLayer.borderColor || '#ffffff'} onChange={e => updateLayer(selectedLayerIndex!, { borderColor: e.target.value })} className="w-full" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Border Width</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="0" max="10" value={selectedLayer.borderWidth || 0} onChange={e => updateLayer(selectedLayerIndex!, { borderWidth: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.borderWidth || 0} onChange={e => updateLayer(selectedLayerIndex!, { borderWidth: Number(e.target.value) })} min="0" max="10" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Width</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="5" max="100" value={selectedLayer.width || 30} onChange={e => updateLayer(selectedLayerIndex!, { width: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.width || 30} onChange={e => updateLayer(selectedLayerIndex!, { width: Number(e.target.value) })} min="5" max="100" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Height</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="5" max="100" value={selectedLayer.height || 20} onChange={e => updateLayer(selectedLayerIndex!, { height: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.height || 20} onChange={e => updateLayer(selectedLayerIndex!, { height: Number(e.target.value) })} min="5" max="100" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Rotation (°)</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="-180" max="180" value={selectedLayer.rotation || 0} onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-16 p-1 border rounded text-sm" value={selectedLayer.rotation || 0} onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })} min="-180" max="180" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!selectedLayer.shadow}
                              onChange={e => {
                                if (e.target.checked) {
                                  updateLayer(selectedLayerIndex!, {
                                    shadow: { color: 'rgba(0,0,0,0.1)', blur: 2, offsetX: 0, offsetY: 0 }
                                  });
                                } else {
                                  updateLayer(selectedLayerIndex!, { shadow: null });
                                }
                              }}
                            />
                            Enable Shadow
                          </label>
                        </div>
                        {selectedLayer.shadow && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div><label className="text-xs">Color</label><input type="color" value={selectedLayer.shadow.color || '#000000'} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, color: e.target.value } })} className="w-full" /></div>
                            <div><label className="text-xs">Blur</label><input type="range" min="0" max="20" value={selectedLayer.shadow.blur || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, blur: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" /></div>
                            <div><label className="text-xs">Offset X</label><input type="range" min="-10" max="10" value={selectedLayer.shadow.offsetX || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetX: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" /></div>
                            <div><label className="text-xs">Offset Y</label><input type="range" min="-10" max="10" value={selectedLayer.shadow.offsetY || 0} onChange={e => updateLayer(selectedLayerIndex!, { shadow: { ...selectedLayer.shadow, offsetY: Number(e.target.value) } })} className="flex-1 accent-[#0D4F4F]" /></div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Position</label>
                        <div className="flex gap-1">{ALIGN_H.map(a => (<button key={a.value} onClick={() => updateLayer(selectedLayerIndex!, { x: a.value })} className="p-1 border rounded flex-1">{a.label}</button>))}</div>
                        <div className="flex gap-1 mt-1">{ALIGN_V.map(a => (<button key={a.value} onClick={() => updateLayer(selectedLayerIndex!, { y: a.value })} className="p-1 border rounded flex-1">{a.label}</button>))}</div>
                      </div>
                    </div>
                  )}

                  {selectedLayer.type === 'line' && (
                    <div className="space-y-3">
                      <div>
                        <label className="flex justify-between text-sm">Stroke Color</label>
                        <input type="color" value={selectedLayer.strokeColor || '#ffffff'} onChange={e => updateLayer(selectedLayerIndex!, { strokeColor: e.target.value })} className="w-full" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Stroke Width</label>
                        <div className="flex gap-2 items-center">
                          <input type="range" min="1" max="10" value={selectedLayer.strokeWidth || 2} onChange={e => updateLayer(selectedLayerIndex!, { strokeWidth: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.strokeWidth || 2} onChange={e => updateLayer(selectedLayerIndex!, { strokeWidth: Number(e.target.value) })} min="1" max="10" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Dash Style</label>
                        <select
                          className="w-full p-1 border rounded text-sm"
                          value={selectedLayer.dashArray || 'solid'}
                          onChange={e => updateLayer(selectedLayerIndex!, { dashArray: e.target.value })}
                        >
                          <option value="solid">Solid</option>
                          <option value="dashed">Dashed</option>
                          <option value="dotted">Dotted</option>
                        </select>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Arrow Start</label>
                        <select
                          className="w-full p-1 border rounded text-sm"
                          value={selectedLayer.arrowStart || 'none'}
                          onChange={e => updateLayer(selectedLayerIndex!, { arrowStart: e.target.value })}
                        >
                          <option value="none">None</option>
                          <option value="arrow">Arrow</option>
                        </select>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Arrow End</label>
                        <select
                          className="w-full p-1 border rounded text-sm"
                          value={selectedLayer.arrowEnd || 'none'}
                          onChange={e => updateLayer(selectedLayerIndex!, { arrowEnd: e.target.value })}
                        >
                          <option value="none">None</option>
                          <option value="arrow">Arrow</option>
                        </select>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">Start Position</label>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs">X</span>
                          <input type="range" min="0" max="100" value={selectedLayer.startX || 10} onChange={e => updateLayer(selectedLayerIndex!, { startX: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.startX || 10} onChange={e => updateLayer(selectedLayerIndex!, { startX: Number(e.target.value) })} min="0" max="100" />
                          <span className="text-xs">Y</span>
                          <input type="range" min="0" max="100" value={selectedLayer.startY || 50} onChange={e => updateLayer(selectedLayerIndex!, { startY: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.startY || 50} onChange={e => updateLayer(selectedLayerIndex!, { startY: Number(e.target.value) })} min="0" max="100" />
                        </div>
                      </div>
                      <div>
                        <label className="flex justify-between text-sm">End Position</label>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs">X</span>
                          <input type="range" min="0" max="100" value={selectedLayer.endX || 90} onChange={e => updateLayer(selectedLayerIndex!, { endX: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.endX || 90} onChange={e => updateLayer(selectedLayerIndex!, { endX: Number(e.target.value) })} min="0" max="100" />
                          <span className="text-xs">Y</span>
                          <input type="range" min="0" max="100" value={selectedLayer.endY || 50} onChange={e => updateLayer(selectedLayerIndex!, { endY: Number(e.target.value) })} className="flex-1 accent-[#0D4F4F]" />
                          <input type="number" className="w-12 p-1 border rounded text-sm" value={selectedLayer.endY || 50} onChange={e => updateLayer(selectedLayerIndex!, { endY: Number(e.target.value) })} min="0" max="100" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!selectedLayer.shadow}
                            onChange={e => {
                              if (e.target.checked) {
                                updateLayer(selectedLayerIndex!, {
                                  shadow: { color: 'rgba(0,0,0,0.1)', blur: 2, offsetX: 0, offsetY: 0 }
                                });
                              } else {
                                updateLayer(selectedLayerIndex!, { shadow: null });
                              }
                            }}
                          />
                          Enable Shadow
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm">Select a layer to edit its properties</div>
              )}
            </Section>

            <Section title="🎨 Overlay" section="overlay">
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
            </Section>

            <Section title="📲 QR Code" section="qr">
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm">Horizontal <span>{Math.round(qrX)}%</span></label>
                  <input type="range" min="0" max="100" value={qrX} onChange={e => setQrX(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Vertical <span>{Math.round(qrY)}%</span></label>
                  <input type="range" min="0" max="100" value={qrY} onChange={e => setQrY(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Size <span>{qrSize}px</span></label>
                  <input type="range" min="80" max="300" step="10" value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full accent-[#0D4F4F]" />
                </div>
                <div>
                  <label className="flex justify-between text-sm">Color</label>
                  <input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)} className="w-full" />
                </div>
              </div>
            </Section>
          </div>

          {/* Save button (always visible) */}
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