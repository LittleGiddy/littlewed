'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload, Move, Maximize2, Save, Loader2, Image as ImageIcon, Trash2, Check, Type, Palette,
  AlignLeft, AlignCenter, AlignRight, Square, Minus, Plus, Copy, ArrowUp, ArrowDown, 
  Layers, Eye, EyeOff, Undo, Redo, Lock, Unlock, Grid, ChevronDown, ChevronRight,
  Settings, QrCode, User, Users, UserCheck, Hash, Sparkles, AlertCircle, RotateCw,
  X, Maximize, Minimize, ArrowRight
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
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ─── Debounce timer for history ──────────────────────────────────────
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{ type: string; index: number; point?: 'start' | 'end' } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState<{ index: number; type: string } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, initialSize: 0, initialWidth: 0, initialHeight: 0, initialFontSize: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
      toast.error('File size exceeds 3MB limit. Please compress your image and try again.');
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

  // ─── Layer operations with history ──────────────────────────────────
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
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4F4F]" />
        <p className="text-sm text-gray-400">Loading designer...</p>
      </div>
    );
  }

  const selectedLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const Section = ({ title, icon, section, children }: any) => {
    const isCollapsed = collapsedSections[section];
    return (
      <div className="border-b border-gray-100 last:border-0">
        <button
          onClick={() => toggleSection(section)}
          className="w-full flex items-center justify-between p-2 text-left font-semibold text-gray-700 hover:bg-gray-50 transition text-sm"
        >
          <span className="flex items-center gap-2">{icon && <span className="text-[#0D4F4F]">{icon}</span>}{title}</span>
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {!isCollapsed && <div className="p-2 pt-0">{children}</div>}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-gray-900">Invitation Designer</h1>
          <p className="text-xs sm:text-sm text-gray-500">Design your card with text, shapes, and QR code</p>
        </div>
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 sm:p-2 rounded-lg transition ${showGrid ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title="Toggle grid"
          >
            <Grid size={16} className="sm:text-lg" />
          </button>
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 sm:p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} className="sm:text-lg" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 sm:p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} className="sm:text-lg" />
          </button>
          <button
            onClick={() => setIsFullPreview(!isFullPreview)}
            className="p-1.5 sm:p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            title={isFullPreview ? 'Minimize preview' : 'Maximize preview'}
          >
            {isFullPreview ? <Minimize size={16} className="sm:text-lg" /> : <Maximize size={16} className="sm:text-lg" />}
          </button>
        </div>
      </div>

      {/* ─── Template Gallery ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 sm:mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <ImageIcon size={16} className="sm:text-lg text-[#0D4F4F]" /> Choose a Template
          </h2>
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer bg-[#0D4F4F] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#0A3D3D] transition flex items-center gap-1.5 sm:gap-2">
              <Upload size={14} /> Upload
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
                ref={fileInputRef} 
              />
            </label>
            {uploading && <Loader2 size={16} className="animate-spin text-[#0D4F4F]" />}
            {templateUrl && (
              <button
                onClick={() => { setTemplateUrl(null); setSelectedTemplateId(null); }}
                className="bg-red-50 text-red-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-100 transition flex items-center gap-1.5 sm:gap-2"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-2 sm:mb-3">Max file size: 3MB</p>
        {templates.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-400">
            <ImageIcon size={28} className="sm:text-4xl mx-auto mb-2 opacity-50" />
            <p className="text-sm">No templates available. Upload your own background.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t)}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition hover:shadow-md ${selectedTemplateId === t.id ? 'border-[#0D4F4F] shadow-md' : 'border-transparent'}`}
              >
                <img src={t.imageUrl} alt={t.name} className="w-full aspect-[3/4] object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 sm:p-2">
                  <p className="text-white text-[10px] sm:text-xs font-medium truncate">{t.name}</p>
                </div>
                {selectedTemplateId === t.id && (
                  <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 bg-[#0D4F4F] rounded-full p-0.5 sm:p-1">
                    <Check size={10} className="sm:text-xs text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {templateUrl && !templates.some(t => t.imageUrl === templateUrl) && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Check size={12} className="text-green-600" /> Custom uploaded card
          </p>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Preview ─── */}
        <div className={`lg:col-span-${isFullPreview ? '3' : '2'}`}>
          <div 
            ref={previewRef}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="font-semibold flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                <Maximize2 size={16} className="sm:text-lg text-[#0D4F4F]" /> Live Preview
              </h2>
              <span className="text-[10px] sm:text-xs text-gray-400">Drag to reposition</span>
            </div>
            <div
              ref={canvasRef}
              className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] max-h-[70vh] mx-auto"
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

                  {/* ─── QR Code - Clean version ─── */}
                  <div
                    className="absolute flex items-center justify-center cursor-move touch-none select-none pointer-events-auto group"
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
                      <div className="absolute inset-0 opacity-[0.03]" style={{ 
                        backgroundImage: `radial-gradient(circle at 2px 2px, ${qrColor} 1px, transparent 1px)`,
                        backgroundSize: '6px 6px'
                      }} />
                      
                      <div className="flex flex-col items-center justify-center gap-0.5 relative z-10">
                        <QrCode 
                          size={Math.min(Math.max(qrSize * 0.5, 28), 72)} 
                          style={{ color: qrColor === '#000000' ? '#0D4F4F' : qrColor }}
                          className="drop-shadow-sm"
                        />
                        <span className="text-[8px] font-mono tracking-wider opacity-60" style={{ color: qrColor }}>
                          SCAN ME
                        </span>
                      </div>

                      <div className="absolute top-1.5 left-1.5 w-3 h-3 border-l-2 border-t-2 opacity-30" style={{ borderColor: qrColor }} />
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 border-r-2 border-t-2 opacity-30" style={{ borderColor: qrColor }} />
                      <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-l-2 border-b-2 opacity-30" style={{ borderColor: qrColor }} />
                      <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-r-2 border-b-2 opacity-30" style={{ borderColor: qrColor }} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center p-4">
                    <ImageIcon size={32} className="sm:text-4xl mx-auto mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">Select a template or upload your own</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-2 sm:mt-3">
              Click a layer to edit properties below
            </p>
          </div>
        </div>

        {/* ─── Controls ─── */}
        {!isFullPreview && (
          <div className="lg:col-span-1 space-y-3">
            {/* ─── Quick Add ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#0D4F4F]" /> Quick Add
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={addGuestNameLayer}
                  className="bg-[#0D4F4F] text-white px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1"
                >
                  <User size={12} /> Guest Name
                </button>
                <button
                  onClick={addGuestTitleLayer}
                  className="bg-[#0D4F4F] text-white px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1"
                >
                  <UserCheck size={12} /> Title
                </button>
                <button
                  onClick={addGuestTypeLayer}
                  className="bg-[#0D4F4F] text-white px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1"
                >
                  <Users size={12} /> Guest Type
                </button>
                <button
                  onClick={addCardNumberLayer}
                  className="bg-[#0D4F4F] text-white px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-1"
                >
                  <Hash size={12} /> Card No.
                </button>
                <button
                  onClick={addTextLayer}
                  className="bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1 col-span-2"
                >
                  <Type size={12} /> Custom Text
                </button>
              </div>
            </div>

            {/* ─── Controls Accordion ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-h-[60vh] overflow-y-auto">
              <Section title="Shapes" section="addLayer" icon={<Square size={14} />}>
                <div className="flex gap-2">
                  <button onClick={addRectLayer} className="flex-1 bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1">
                    <Square size={12} /> Rectangle
                  </button>
                  <button onClick={addLineLayer} className="flex-1 bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-1">
                    <Minus size={12} /> Line
                  </button>
                </div>
              </Section>

              <Section title="Layers" section="layers" icon={<Layers size={14} />}>
                {layers.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-xs">
                    <Layers size={20} className="mx-auto mb-2 opacity-30" />
                    No layers. Add one above!
                  </div>
                )}
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {layers.map((layer, idx) => (
                    <div
                      key={layer.id}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer hover:bg-gray-50 transition ${idx === selectedLayerIndex ? 'bg-[rgba(13,79,79,0.08)] border-l-4 border-[#0D4F4F]' : ''}`}
                      onClick={() => setSelectedLayerIndex(idx)}
                    >
                      <span className="text-[10px] truncate flex items-center gap-1">
                        {layer.type === 'text' && <Type size={10} />}
                        {layer.type === 'rect' && <Square size={10} />}
                        {layer.type === 'line' && <Minus size={10} />}
                        {layer.isGuestName && <User size={10} className="text-[#0D4F4F]" />}
                        {layer.isGuestType && <UserCheck size={10} className="text-[#0D4F4F]" />}
                        {layer.isCardNumber && <Hash size={10} className="text-[#0D4F4F]" />}
                        <span className="truncate max-w-[40px]">
                          {layer.type === 'text' ? layer.text.substring(0, 10) : layer.type === 'rect' ? 'Rect' : 'Line'}
                        </span>
                      </span>
                      <div className="flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Toggle visibility">
                          {layer.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Toggle lock">
                          {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateLayer(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Duplicate">
                          <Copy size={10} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayerUp(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Move up">
                          <ArrowUp size={10} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayerDown(idx); }} className="p-1 hover:bg-gray-200 rounded" title="Move down">
                          <ArrowDown size={10} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(idx); }} className="p-1 hover:bg-red-100 rounded text-red-500" title="Delete">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Properties" section="properties" icon={<Settings size={14} />}>
                {selectedLayer ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedLayer.type === 'text' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Text</label>
                          <textarea
                            className="w-full p-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                            rows={2}
                            value={selectedLayer.text}
                            onChange={e => updateLayer(selectedLayerIndex!, { text: e.target.value })}
                          />
                          {selectedLayer.isGuestName && (
                            <p className="text-[8px] text-[#0D4F4F] mt-0.5">Replaced with each guest's name</p>
                          )}
                          {selectedLayer.isGuestType && (
                            <p className="text-[8px] text-[#0D4F4F] mt-0.5">Replaced with "Single" or "Double"</p>
                          )}
                          {selectedLayer.isCardNumber && (
                            <p className="text-[8px] text-[#0D4F4F] mt-0.5">Replaced with each guest's card number</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Font</label>
                          <select
                            className="w-full p-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                            value={selectedLayer.fontFamily}
                            onChange={e => updateLayer(selectedLayerIndex!, { fontFamily: e.target.value })}
                          >
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Size</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="8"
                              max="100"
                              value={selectedLayer.fontSize}
                              onChange={e => updateLayer(selectedLayerIndex!, { fontSize: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.fontSize}
                              onChange={e => updateLayer(selectedLayerIndex!, { fontSize: Number(e.target.value) })}
                              min="8"
                              max="100"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Color</label>
                          <input
                            type="color"
                            value={selectedLayer.color}
                            onChange={e => updateLayer(selectedLayerIndex!, { color: e.target.value })}
                            className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Alignment</label>
                          <div className="flex gap-1">
                            {['left', 'center', 'right'].map(a => (
                              <button
                                key={a}
                                onClick={() => updateLayer(selectedLayerIndex!, { align: a })}
                                className={`flex-1 p-1 rounded-lg border transition ${selectedLayer.align === a ? 'bg-[#0D4F4F] text-white border-[#0D4F4F]' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                              >
                                {a === 'left' ? <AlignLeft size={12} /> : a === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Rotation</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              value={selectedLayer.rotation || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.rotation || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })}
                              min="-180"
                              max="180"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700">
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
                            Shadow
                          </label>
                        </div>
                      </>
                    )}

                    {selectedLayer.type === 'rect' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Fill Color</label>
                          <input
                            type="color"
                            value={selectedLayer.fill || '#ffffff'}
                            onChange={e => updateLayer(selectedLayerIndex!, { fill: e.target.value })}
                            className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Border Color</label>
                          <input
                            type="color"
                            value={selectedLayer.borderColor || '#ffffff'}
                            onChange={e => updateLayer(selectedLayerIndex!, { borderColor: e.target.value })}
                            className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Border Width</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={selectedLayer.borderWidth || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { borderWidth: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.borderWidth || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { borderWidth: Number(e.target.value) })}
                              min="0"
                              max="10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Width / Height</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="range"
                              min="5"
                              max="100"
                              value={selectedLayer.width || 30}
                              onChange={e => updateLayer(selectedLayerIndex!, { width: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.width || 30}
                              onChange={e => updateLayer(selectedLayerIndex!, { width: Number(e.target.value) })}
                              min="5"
                              max="100"
                            />
                            <span className="text-[10px] text-gray-400">×</span>
                            <input
                              type="range"
                              min="5"
                              max="100"
                              value={selectedLayer.height || 20}
                              onChange={e => updateLayer(selectedLayerIndex!, { height: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.height || 20}
                              onChange={e => updateLayer(selectedLayerIndex!, { height: Number(e.target.value) })}
                              min="5"
                              max="100"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Rotation</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              value={selectedLayer.rotation || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.rotation || 0}
                              onChange={e => updateLayer(selectedLayerIndex!, { rotation: Number(e.target.value) })}
                              min="-180"
                              max="180"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedLayer.type === 'line' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Stroke Color</label>
                          <input
                            type="color"
                            value={selectedLayer.strokeColor || '#ffffff'}
                            onChange={e => updateLayer(selectedLayerIndex!, { strokeColor: e.target.value })}
                            className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Stroke Width</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={selectedLayer.strokeWidth || 2}
                              onChange={e => updateLayer(selectedLayerIndex!, { strokeWidth: Number(e.target.value) })}
                              className="flex-1 accent-[#0D4F4F]"
                            />
                            <input
                              type="number"
                              className="w-12 p-1 border border-gray-200 rounded-lg text-xs text-center"
                              value={selectedLayer.strokeWidth || 2}
                              onChange={e => updateLayer(selectedLayerIndex!, { strokeWidth: Number(e.target.value) })}
                              min="1"
                              max="10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-700">Dash Style</label>
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
                    <Settings size={20} className="mx-auto mb-2 opacity-30" />
                    Select a layer to edit
                  </div>
                )}
              </Section>

              <Section title="Overlay" section="overlay" icon={<Palette size={14} />}>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Color</label>
                    <input
                      type="color"
                      value={overlayColor}
                      onChange={e => setOverlayColor(e.target.value)}
                      className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Opacity</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                        className="flex-1 accent-[#0D4F4F]"
                      />
                      <span className="text-[10px] text-gray-500 w-10 text-right">{Math.round(overlayOpacity * 100)}%</span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="QR Code" section="qr" icon={<QrCode size={14} />}>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Position</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round(qrX)}
                        onChange={e => setQrX(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-full p-1 border border-gray-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                        placeholder="X"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round(qrY)}
                        onChange={e => setQrY(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-full p-1 border border-gray-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                        placeholder="Y"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="40"
                        max="300"
                        step="5"
                        value={qrSize}
                        onChange={e => setQrSize(Number(e.target.value))}
                        className="flex-1 accent-[#0D4F4F]"
                      />
                      <input
                        type="number"
                        min="40"
                        max="300"
                        step="5"
                        value={qrSize}
                        onChange={e => setQrSize(Math.min(300, Math.max(40, Number(e.target.value))))}
                        className="w-14 p-1 border border-gray-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Rotation</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={qrRotation}
                        onChange={e => setQrRotation(Number(e.target.value))}
                        className="flex-1 accent-[#0D4F4F]"
                      />
                      <input
                        type="number"
                        min="-180"
                        max="180"
                        value={qrRotation}
                        onChange={e => setQrRotation(Math.min(180, Math.max(-180, Number(e.target.value))))}
                        className="w-14 p-1 border border-gray-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Color</label>
                    <input
                      type="color"
                      value={qrColor}
                      onChange={e => setQrColor(e.target.value)}
                      className="w-full h-7 rounded-lg cursor-pointer border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700">Quick Presets</label>
                    <div className="flex gap-1">
                      {[
                        { label: 'Small', size: 80 },
                        { label: 'Medium', size: 150 },
                        { label: 'Large', size: 200 },
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
              </Section>
            </div>

            {/* ─── Save Button ─── */}
            <button
              onClick={handleSave}
              disabled={saving || !templateUrl}
              className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Design'}
            </button>
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
                Your invitation design has been saved successfully. 
                Now it's time to generate personalized cards for your guests.
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