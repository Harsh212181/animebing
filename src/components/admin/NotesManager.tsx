 // src/components/admin/NotesManager.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface Note {
  _id: string;
  title: string;
  content: string;
  color: string;          // background color
  textColor?: string;     // text color
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  labels: string[];
  checklist?: ChecklistItem[];
  reminder?: string | null;
  createdBy: string;
  createdByName?: string;
  createdByRole?: 'admin' | 'subadmin';
  createdAt?: string;
  updatedAt?: string;
}

interface NotesManagerProps {
  token: string;
  apiBase: string;
  isSuperAdmin?: boolean;
}

// ── Color palette (presets) ──────────────────────────────────────
const PRESET_COLORS = [
  { name: 'Default', value: '#1c1b29', ring: 'ring-white/20' },
  { name: 'Red',     value: '#4a1e1e', ring: 'ring-red-500/50' },
  { name: 'Orange',  value: '#4a331a', ring: 'ring-orange-500/50' },
  { name: 'Yellow',  value: '#4a441a', ring: 'ring-yellow-500/50' },
  { name: 'Green',   value: '#1e4a2a', ring: 'ring-emerald-500/50' },
  { name: 'Teal',    value: '#1a4a44', ring: 'ring-teal-500/50' },
  { name: 'Blue',    value: '#1a334a', ring: 'ring-blue-500/50' },
  { name: 'Purple',  value: '#2e1a4a', ring: 'ring-purple-500/50' },
  { name: 'Pink',    value: '#4a1a3d', ring: 'ring-pink-500/50' },
];

// ── Text color presets ──────────────────────────────────────────
const TEXT_COLORS = [
  { name: 'White',  value: '#ffffff' },
  { name: 'Black',  value: '#000000' },
  { name: 'Gray',   value: '#9ca3af' },
  { name: 'Red',    value: '#f87171' },
  { name: 'Orange', value: '#fb923c' },
  { name: 'Yellow', value: '#fbbf24' },
  { name: 'Green',  value: '#34d399' },
  { name: 'Blue',   value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Pink',   value: '#f472b6' },
];

// ── Custom Color Picker Graph (upgraded) ─────────────────────────
interface ColorPickerGraphProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorPickerGraph: React.FC<ColorPickerGraphProps> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lightness, setLightness] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hexInput, setHexInput] = useState(color);

  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };

  const CANVAS_W = 300;
  const CANVAS_H = 180;

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const hue = (x / w) * 360;
        const sat = (y / h) * 100;
        const hex = hslToHex(hue, sat, lightness);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [lightness]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const getColorAt = (x: number, y: number): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '#1c1b29';
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = Math.min(Math.max(0, x * scaleX), canvas.width - 1);
    const py = Math.min(Math.max(0, y * scaleY), canvas.height - 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#1c1b29';
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    const [r, g, b] = pixel;
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  };

  const applyColor = (c: string) => {
    onChange(c);
    setHexInput(c);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    applyColor(getColorAt(e.clientX - rect.left, e.clientY - rect.top));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    applyColor(getColorAt(e.clientX - rect.left, e.clientY - rect.top));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    applyColor(getColorAt(e.clientX - rect.left, e.clientY - rect.top));
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  useEffect(() => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = ((max + min) / 2 / 255) * 100;
    setLightness(Math.round(l));
    setHexInput(color);
  }, [color]);

  const handleHexSubmit = (val: string) => {
    let v = val.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      applyColor(v.toLowerCase());
    } else {
      setHexInput(color);
    }
  };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className="w-full h-auto rounded-lg border border-white/10 cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-white/30 w-5">L</span>
        <input
          type="range"
          min="0"
          max="100"
          value={lightness}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setLightness(val);
            drawGraph();
          }}
          className="flex-1 h-1 rounded-full bg-white/20 accent-purple-500"
        />
        <span className="text-[9px] text-white/30 w-6">{lightness}%</span>
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-5 h-5 rounded-md border border-white/20 flex-shrink-0"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hexInput) ? hexInput : color }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => handleHexSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleHexSubmit((e.target as HTMLInputElement).value);
            }
          }}
          placeholder="#a3f2c1"
          maxLength={7}
          className="flex-1 min-w-0 bg-black/20 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/80 outline-none focus:border-purple-500/50 font-mono"
        />
      </div>
    </div>
  );
};

// ── Icons ──────────────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string; fill?: boolean }> = ({ d, className = 'w-4 h-4', fill = false }) => (
  <svg
    className={className}
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={1.8}
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  pin: 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM12 14v8',
  archive: 'M4 8h16M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8M4 8L6 4h12l2 4M10 12h4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  restore: 'M4 4v5h5M4.5 9A8 8 0 0119 8',
  deleteForever: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  close: 'M6 18L18 6M6 6l12 12',
  palette: 'M12 21a9 9 0 110-18 9 9 0 010 18zM7.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4-4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4 1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm.5 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  checkbox: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
  tag: 'M7 7h.01M3 11V6a3 3 0 013-3h5.172a2 2 0 011.414.586l7.828 7.828a2 2 0 010 2.828l-6.172 6.172a2 2 0 01-2.828 0L3.586 12.414A2 2 0 013 11z',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  check: 'M5 13l4 4L19 7',
  plusSmall: 'M12 4v16m8-8H4',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  emptyTrash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16M9 3h6',
  restoreAll: 'M4 4v5h5M4.5 9A8 8 0 0119 8M19 8v5m0 0h-5m5 0a8 8 0 01-14.5 3',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  admin: 'M12 4l8 4v5c0 5.25-3.13 10.15-8 11.5-4.87-1.35-8-6.25-8-11.5V8l8-4z',
  all: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
  clear: 'M6 18L18 6M6 6l12 12',
  textColorIcon: 'M4 6h16M4 12h12M4 18h8',
};

const StickyNoteIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ── Link preview helpers ────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/i;

const extractFirstUrl = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match) return null;
  return match[0].replace(/[.,)>\]]+$/, '');
};

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  domain: string;
}

const linkPreviewCache = new Map<string, LinkPreview | null>();

const LinkPreviewCard: React.FC<{ url: string; apiBase: string; token: string }> = ({ url, apiBase, token }) => {
  const [preview, setPreview] = useState<LinkPreview | null>(linkPreviewCache.get(url) ?? null);
  const [loading, setLoading] = useState(!linkPreviewCache.has(url));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (linkPreviewCache.has(url)) {
      const cached = linkPreviewCache.get(url) ?? null;
      setPreview(cached);
      setFailed(!cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${apiBase}/notes/link-preview`, {
        params: { url },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const p: LinkPreview | null = data.success ? data.preview : null;
        linkPreviewCache.set(url, p);
        setPreview(p);
        setFailed(!p);
      })
      .catch(() => {
        if (cancelled) return;
        linkPreviewCache.set(url, null);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [url, apiBase, token]);

  if (loading) {
    return <div className="mt-1.5 rounded-xl border border-white/10 bg-black/20 h-14 animate-pulse" />;
  }
  if (failed || !preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-1.5 flex items-stretch rounded-xl border border-white/10 bg-black/20 overflow-hidden hover:border-white/25 hover:bg-black/30 transition-all group/link"
    >
      {preview.image && (
        <div className="w-20 sm:w-24 flex-shrink-0 bg-white/5">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center gap-0.5">
        <p className="text-[11px] font-medium text-white/85 line-clamp-1 group-hover/link:text-purple-300 transition-colors">
          {preview.title}
        </p>
        {preview.description && (
          <p className="text-[10px] text-white/45 line-clamp-2">{preview.description}</p>
        )}
        <p className="text-[9px] text-white/30 flex items-center gap-1 mt-0.5">
          <SvgIcon d={ICONS.link} className="w-2.5 h-2.5" />
          {preview.domain}
        </p>
      </div>
    </a>
  );
};

type ViewTab = 'notes' | 'archive' | 'trash';
type CreatorFilter = 'all' | 'admin' | 'subadmin';

const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatReminder = (iso?: string | null): string => {
  if (!iso) return '';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  const now = Date.now();
  const diff = dt.getTime() - now;
  if (diff < 0) return '⏰ Overdue';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `in ${days}d`;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// ── Utility: checklist progress ──────────────────────────────────
const checklistProgress = (checklist?: ChecklistItem[]) => {
  if (!checklist || checklist.length === 0) return null;
  const done = checklist.filter(c => c.checked).length;
  return { done, total: checklist.length };
};

// ── ColorPickerPopover (moved outside, now full-width) ────────────
interface ColorPickerPopoverProps {
  targetColor: string;
  onChange: (color: string) => void;
  target: 'bg' | 'text';
  setTarget: (t: 'bg' | 'text') => void;
}

const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({ targetColor, onChange, target, setTarget }) => {
  const presetList = target === 'bg' ? PRESET_COLORS : TEXT_COLORS;
  return (
    <div className="p-3 rounded-xl bg-[#1a1926] border border-white/10 shadow-xl w-full animate-[fadeIn_0.15s_ease]">
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setTarget('bg')}
          className={`flex-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all ${
            target === 'bg'
              ? 'bg-purple-500/20 text-purple-200'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          Bg
        </button>
        <button
          onClick={() => setTarget('text')}
          className={`flex-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all ${
            target === 'text'
              ? 'bg-purple-500/20 text-purple-200'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          Text
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presetList.map(c => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 ${
              targetColor === c.value ? 'ring-2 ring-offset-1 ring-offset-[#1a1926] ring-white/50' : ''
            }`}
            style={{ backgroundColor: c.value }}
            title={c.name}
          />
        ))}
      </div>
      <ColorPickerGraph color={targetColor} onChange={onChange} />
    </div>
  );
};

// ── SkeletonCard (moved outside) ───────────────────────────────────
const SkeletonCard: React.FC<{ h?: number }> = ({ h = 140 }) => (
  <div
    className="rounded-2xl border border-white/10 bg-white/[0.03] mb-4 break-inside-avoid animate-pulse"
    style={{ height: h }}
  />
);

// ── NoteCard (moved outside) ───────────────────────────────────────
interface NoteCardProps {
  note: Note;
  activeView: ViewTab;
  isSuperAdmin?: boolean;
  editingNoteId: string | null;
  editTitle: string; setEditTitle: (v: string) => void;
  editContent: string; setEditContent: (v: string) => void;
  editColor: string; setEditColor: (v: string) => void;
  editTextColor: string; setEditTextColor: (v: string) => void;
  editChecklist: ChecklistItem[];
  editLabels: string[];
  editLabelInput: string; setEditLabelInput: (v: string) => void;
  editChecklistInput: string; setEditChecklistInput: (v: string) => void;
  editLabelFocused: boolean; setEditLabelFocused: (v: boolean) => void;
  editReminder: string; setEditReminder: (v: string) => void;
  editTextareaRef: React.RefObject<HTMLTextAreaElement | null>; // ✅ React 19 compatible
  labelSuggestions: string[];
  apiBase: string; token: string;
  showColorPicker: string | null; setShowColorPicker: (v: string | null) => void;
  colorPickerTarget: 'bg' | 'text'; setColorPickerTarget: (t: 'bg' | 'text') => void;
  startEdit: (note: Note) => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  togglePin: (note: Note) => void;
  changeColor: (note: Note, color: string, target: 'bg' | 'text') => void;
  archiveNote: (note: Note) => void;
  trashNote: (note: Note) => void;
  restoreNote: (note: Note) => void;
  deleteForever: (note: Note) => void;
  toggleChecklistItem: (note: Note, index: number) => void;
  toggleEditChecklistItem: (index: number) => void;
  removeEditChecklistItem: (index: number) => void;
  addEditChecklistItem: () => void;
  addEditLabel: (val?: string) => void;
  removeEditLabel: (label: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  activeView,
  isSuperAdmin,
  editingNoteId,
  editTitle, setEditTitle,
  editContent, setEditContent,
  editColor, setEditColor,
  editTextColor, setEditTextColor,
  editChecklist,
  editLabels,
  editLabelInput, setEditLabelInput,
  editChecklistInput, setEditChecklistInput,
  editLabelFocused, setEditLabelFocused,
  editReminder, setEditReminder,
  editTextareaRef,
  labelSuggestions,
  apiBase, token,
  showColorPicker, setShowColorPicker,
  colorPickerTarget, setColorPickerTarget,
  startEdit,
  cancelEdit,
  saveEdit,
  togglePin,
  changeColor,
  archiveNote,
  trashNote,
  restoreNote,
  deleteForever,
  toggleChecklistItem,
  toggleEditChecklistItem,
  removeEditChecklistItem,
  addEditChecklistItem,
  addEditLabel,
  removeEditLabel,
}) => {
  const progress = checklistProgress(note.checklist);
  const isEditing = editingNoteId === note._id;
  const textColor = note.textColor || '#ffffff';

  if (isEditing) {
    // ── INLINE EDIT MODE ──
    return (
      <div
        className="rounded-2xl border border-purple-500/40 p-5 space-y-3 shadow-2xl shadow-purple-900/20 mb-4 transition-all"
        style={{ backgroundColor: editColor }}
      >
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent text-base font-bold outline-none"
          style={{ color: editTextColor }}
        />
        <div className="flex items-center gap-2 flex-wrap" style={{ color: editTextColor }}>
          {isSuperAdmin && note.createdByRole === 'subadmin' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
              by {note.createdByName || 'Sub-Admin'}
            </span>
          )}
          <span className="text-[9px] flex items-center gap-1" style={{ opacity: 0.6 }}>
            <SvgIcon d={ICONS.clock} className="w-2.5 h-2.5" />
            Edited {timeAgo(note.updatedAt || note.createdAt)}
          </span>
        </div>

        <textarea
          ref={editTextareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          placeholder="Note content"
          className="w-full bg-transparent text-sm outline-none resize-none leading-relaxed"
          style={{ color: editTextColor, minHeight: '60px' }}
        />

        {(() => {
          const url = extractFirstUrl(editContent) || extractFirstUrl(editTitle);
          return url ? <LinkPreviewCard url={url} apiBase={apiBase} token={token} /> : null;
        })()}

        {/* Checklist */}
        <div className="space-y-1.5">
          {editChecklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs group/edit">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleEditChecklistItem(idx)}
                className="rounded accent-purple-500"
              />
              <span className={`flex-1 ${item.checked ? 'line-through' : ''}`} style={{ color: editTextColor, opacity: item.checked ? 0.3 : 0.8 }}>
                {item.text}
              </span>
              <button onClick={() => removeEditChecklistItem(idx)} className="text-white/20 group-hover/edit:text-white/50 hover:!text-red-400">
                <SvgIcon d={ICONS.close} className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <SvgIcon d={ICONS.plusSmall} className="w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={editChecklistInput}
              onChange={e => setEditChecklistInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditChecklistItem())}
              placeholder="List item"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: editTextColor, opacity: 0.6 }}
            />
          </div>
        </div>

        {/* Labels */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <SvgIcon d={ICONS.tag} className="w-3.5 h-3.5 text-white/30" />
            {editLabels.map(l => (
              <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 flex items-center gap-1" style={{ color: editTextColor, opacity: 0.6 }}>
                {l}
                <button onClick={() => removeEditLabel(l)}>
                  <SvgIcon d={ICONS.close} className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative pl-5">
            <input
              type="text"
              value={editLabelInput}
              onChange={e => setEditLabelInput(e.target.value)}
              onFocus={() => setEditLabelFocused(true)}
              onBlur={() => setTimeout(() => setEditLabelFocused(false), 150)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditLabel())}
              placeholder="+ Add label"
              className="bg-transparent text-[10px] outline-none w-32"
              style={{ color: editTextColor, opacity: 0.6 }}
            />
            {editLabelFocused && editLabelInput.trim() && (
              <div className="absolute z-20 top-5 left-5 w-40 bg-[#1a1926] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                {labelSuggestions
                  .filter(l => l.toLowerCase().includes(editLabelInput.toLowerCase()) && !editLabels.includes(l))
                  .slice(0, 5)
                  .map(l => (
                    <button
                      key={l}
                      onMouseDown={() => addEditLabel(l)}
                      className="block w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      {l}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Reminder — no input shown until user opts in, so no dd-mm-yyyy placeholder */}
        <div className="flex items-center gap-2 flex-wrap pt-1" onClick={(e) => e.stopPropagation()}>
          <SvgIcon d={ICONS.clock} className="w-4 h-4 text-white/50" />
          {editReminder ? (
            <>
              <input
                type="datetime-local"
                value={editReminder}
                onChange={e => setEditReminder(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-purple-500/50"
                style={{ color: editTextColor }}
              />
              <button
                onClick={() => setEditReminder('')}
                className="text-white/30 hover:text-red-400 transition-colors"
                title="Clear reminder"
              >
                <SvgIcon d={ICONS.clear} className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditReminder(new Date(Date.now() + 3600000).toISOString().slice(0, 16))}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              + Add reminder
            </button>
          )}
        </div>

        {/* Color picker: presets + custom hex/canvas picker for both bg and text — inline, not a popup */}
        <div className="pt-2 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] text-white/30 w-8">Bg:</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setEditColor(c.value)}
                className={`w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 ${editColor === c.value ? 'ring-2 ring-offset-1 ' + c.ring : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <button
              onClick={() => { setShowColorPicker(showColorPicker === 'bgEdit' ? null : 'bgEdit'); setColorPickerTarget('bg'); }}
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] transition-colors ${showColorPicker === 'bgEdit' ? 'border-purple-500/60 text-purple-200 bg-purple-500/10' : 'border-white/20 text-white/50 hover:text-white hover:bg-white/10'}`}
              title="Custom background color"
            >
              +
            </button>
          </div>
          {showColorPicker === 'bgEdit' && (
            <div className="mt-2">
              <ColorPickerPopover
                targetColor={editColor}
                onChange={setEditColor}
                target="bg"
                setTarget={setColorPickerTarget}
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] text-white/30 w-8">Text:</span>
            {TEXT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setEditTextColor(c.value)}
                className={`w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110 ${editTextColor === c.value ? 'ring-2 ring-offset-1 ring-offset-[#1a1926] ring-white/50' : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <button
              onClick={() => { setShowColorPicker(showColorPicker === 'textEdit' ? null : 'textEdit'); setColorPickerTarget('text'); }}
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] transition-colors ${showColorPicker === 'textEdit' ? 'border-purple-500/60 text-purple-200 bg-purple-500/10' : 'border-white/20 text-white/50 hover:text-white hover:bg-white/10'}`}
              title="Custom text color"
            >
              +
            </button>
          </div>
          {showColorPicker === 'textEdit' && (
            <div className="mt-2">
              <ColorPickerPopover
                targetColor={editTextColor}
                onChange={setEditTextColor}
                target="text"
                setTarget={setColorPickerTarget}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="text-[10px] text-white/20 flex items-center gap-3">
            <span>{editContent.split(/\s+/).filter(Boolean).length} words</span>
            <span>·</span>
            <span>{editContent.length} characters</span>
            <span className="hidden sm:inline">· Esc to close · Ctrl+Enter to save</span>
          </div>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              Cancel
            </button>
            <button onClick={saveEdit} className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 transition-all">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW MODE ──
  return (
    <div
      className="group relative rounded-2xl border border-white/10 p-4 flex flex-col gap-2 break-inside-avoid mb-4 transition-all duration-200 hover:border-white/30 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer"
      style={{ backgroundColor: note.color || '#1c1b29' }}
      onClick={() => startEdit(note)}
    >
      {activeView !== 'trash' && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePin(note); }}
          className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all z-10 ${
            note.pinned
              ? 'opacity-100 text-amber-300 bg-black/20'
              : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-white hover:bg-black/20'
          }`}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <SvgIcon d={ICONS.pin} className="w-4 h-4" fill={note.pinned} />
        </button>
      )}

      {note.title && <h3 className="text-sm font-semibold pr-6 break-words leading-snug" style={{ color: textColor }}>{note.title}</h3>}
      {note.content && (
        <p className="text-xs whitespace-pre-wrap break-words leading-relaxed line-clamp-[10]" style={{ color: textColor, opacity: 0.85 }}>
          {note.content}
        </p>
      )}

      {note.checklist && note.checklist.length > 0 && (
        <div className="space-y-1 mt-1">
          {note.checklist.slice(0, 6).map((item, idx) => (
            <label
              key={idx}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs cursor-pointer group/item"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleChecklistItem(note, idx)}
                className="rounded accent-purple-500 w-3.5 h-3.5"
              />
              <span className={`transition-colors ${item.checked ? 'line-through' : ''}`} style={{ color: textColor, opacity: item.checked ? 0.3 : 0.8 }}>
                {item.text}
              </span>
            </label>
          ))}
          {note.checklist.length > 6 && (
            <p className="text-[10px] pl-5" style={{ color: textColor, opacity: 0.3 }}>+{note.checklist.length - 6} more</p>
          )}
          {progress && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400/70 transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-[9px] shrink-0" style={{ color: textColor, opacity: 0.3 }}>{progress.done}/{progress.total}</span>
            </div>
          )}
        </div>
      )}

      {note.labels && note.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {note.labels.map(l => (
            <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10" style={{ color: textColor, opacity: 0.6 }}>
              {l}
            </span>
          ))}
        </div>
      )}

      {(() => {
        const url = extractFirstUrl(note.content) || extractFirstUrl(note.title);
        return url ? <LinkPreviewCard url={url} apiBase={apiBase} token={token} /> : null;
      })()}

      {note.reminder && (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 self-start">
          <SvgIcon d={ICONS.clock} className="w-3 h-3" />
          <span>{formatReminder(note.reminder)}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1.5 flex-wrap" style={{ color: textColor, opacity: 0.5 }}>
          {isSuperAdmin && note.createdByRole === 'subadmin' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
              by {note.createdByName || 'Sub-Admin'}
            </span>
          )}
          <span className="text-[9px] flex items-center gap-1">
            <SvgIcon d={ICONS.clock} className="w-2.5 h-2.5" />
            {timeAgo(note.updatedAt || note.createdAt)}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 mt-1 pt-2 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {activeView === 'trash' ? (
          <>
            <button onClick={() => restoreNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-emerald-300 hover:bg-white/10" title="Restore">
              <SvgIcon d={ICONS.restore} className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteForever(note)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10" title="Delete forever">
              <SvgIcon d={ICONS.deleteForever} className="w-3.5 h-3.5" />
            </button>
            <span className="ml-auto text-[9px] text-white/20">Deletes permanently soon</span>
          </>
        ) : (
          <>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === note._id ? null : note._id); setColorPickerTarget('bg'); }}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                title="Change color"
              >
                <SvgIcon d={ICONS.palette} className="w-3.5 h-3.5" />
              </button>
              {showColorPicker === note._id && (
                <ColorPickerPopover
                  targetColor={colorPickerTarget === 'bg' ? note.color : (note.textColor || '#ffffff')}
                  onChange={(col) => changeColor(note, col, colorPickerTarget)}
                  target={colorPickerTarget}
                  setTarget={setColorPickerTarget}
                />
              )}
            </div>
            <button onClick={() => archiveNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-blue-300 hover:bg-white/10" title={note.archived ? 'Unarchive' : 'Archive'}>
              <SvgIcon d={ICONS.archive} className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => trashNote(note)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10" title="Delete">
              <SvgIcon d={ICONS.trash} className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── NotesManager component ─────────────────────────────────────────
const NotesManager: React.FC<NotesManagerProps> = ({ token, apiBase, isSuperAdmin }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>('notes');
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>('all');

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [composerColor, setComposerColor] = useState('#1c1b29');
  const [composerTextColor, setComposerTextColor] = useState<string>('#ffffff');
  const [composerChecklist, setComposerChecklist] = useState<ChecklistItem[]>([]);
  const [composerLabels, setComposerLabels] = useState<string[]>([]);
  const [composerLabelInput, setComposerLabelInput] = useState('');
  const [composerChecklistInput, setComposerChecklistInput] = useState('');
  const [composerShowChecklist, setComposerShowChecklist] = useState(false);
  const [composerReminder, setComposerReminder] = useState<string>('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<'bg' | 'text'>('bg');
  const [composerLabelFocused, setComposerLabelFocused] = useState(false);

  // Inline edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('#1c1b29');
  const [editTextColor, setEditTextColor] = useState<string>('#ffffff');
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editLabelInput, setEditLabelInput] = useState('');
  const [editChecklistInput, setEditChecklistInput] = useState('');
  const [editLabelFocused, setEditLabelFocused] = useState(false);
  const [editReminder, setEditReminder] = useState<string>('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Auto-grow textarea for inline edit
  useEffect(() => {
    if (editTextareaRef.current && editingNoteId) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [editContent, editingNoteId]);

  // Fetch notes
  const fetchNotes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = {
        archived: activeView === 'archive' ? 'true' : 'false',
        trashed: activeView === 'trash' ? 'true' : 'false',
      };
      if (search.trim()) params.search = search.trim();
      if (labelFilter) params.label = labelFilter;
      if (creatorFilter !== 'all') params.createdByRole = creatorFilter;

      const { data } = await axios.get(`${apiBase}/notes`, { ...authHeaders, params });
      setNotes(data.notes || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, creatorFilter]);

  useEffect(() => {
    const t = setTimeout(fetchNotes, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, labelFilter]);

  const allLabels = useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach(n => n.labels?.forEach(l => { map[l] = (map[l] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const labelSuggestions = useMemo(() => allLabels.map(([l]) => l), [allLabels]);

  // Composer save/reset
  const composerHasContent = () =>
    composerTitle.trim() || composerContent.trim() || composerChecklist.length > 0 || composerLabels.length > 0 || composerReminder;

  const resetComposer = () => {
    setComposerOpen(false);
    setComposerTitle('');
    setComposerContent('');
    setComposerColor('#1c1b29');
    setComposerTextColor('#ffffff');
    setComposerChecklist([]);
    setComposerLabels([]);
    setComposerLabelInput('');
    setComposerChecklistInput('');
    setComposerShowChecklist(false);
    setComposerReminder('');
    setShowColorPicker(null);
  };

  const saveComposerNote = useCallback(async () => {
    if (!composerHasContent()) {
      resetComposer();
      return;
    }
    try {
      await axios.post(
        `${apiBase}/notes`,
        {
          title: composerTitle.trim(),
          content: composerContent.trim(),
          color: composerColor,
          textColor: composerTextColor,
          checklist: composerChecklist,
          labels: composerLabels,
          reminder: composerReminder || undefined,
        },
        authHeaders
      );
      resetComposer();
      fetchNotes(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerTitle, composerContent, composerColor, composerTextColor, composerChecklist, composerLabels, composerReminder]);

  useEffect(() => {
    if (!composerOpen) return;
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        saveComposerNote();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [composerOpen, saveComposerNote]);

  const addComposerChecklistItem = () => {
    if (!composerChecklistInput.trim()) return;
    setComposerChecklist(prev => [...prev, { text: composerChecklistInput.trim(), checked: false }]);
    setComposerChecklistInput('');
  };

  const addComposerLabel = (val?: string) => {
    const v = (val ?? composerLabelInput).trim();
    if (!v || composerLabels.includes(v)) return;
    setComposerLabels(prev => [...prev, v]);
    setComposerLabelInput('');
  };

  // Note actions
  const togglePin = async (note: Note) => {
    setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, pinned: !n.pinned } : n)));
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { pinned: !note.pinned }, authHeaders);
    } catch {
      toast.error('Failed to update pin');
      fetchNotes(true);
    }
  };

  const changeColor = async (note: Note, color: string, target: 'bg' | 'text') => {
    if (target === 'bg') {
      setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, color } : n)));
      try {
        await axios.put(`${apiBase}/notes/${note._id}`, { color }, authHeaders);
      } catch {
        toast.error('Failed to update background color');
        fetchNotes(true);
      }
    } else {
      setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, textColor: color } : n)));
      try {
        await axios.put(`${apiBase}/notes/${note._id}`, { textColor: color }, authHeaders);
      } catch {
        toast.error('Failed to update text color');
        fetchNotes(true);
      }
    }
  };

  const archiveNote = async (note: Note) => {
    const wasArchived = note.archived;
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { archived: !wasArchived }, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            {wasArchived ? 'Unarchived' : 'Archived'}
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.put(`${apiBase}/notes/${note._id}`, { archived: wasArchived }, authHeaders);
                  fetchNotes(true);
                } catch { /* ignore */ }
              }}
              className="text-purple-300 font-semibold hover:text-purple-200"
            >
              UNDO
            </button>
          </span>
        )
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const trashNote = async (note: Note) => {
    try {
      await axios.delete(`${apiBase}/notes/${note._id}`, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            Moved to trash
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.post(`${apiBase}/notes/${note._id}/restore`, {}, authHeaders);
                  fetchNotes(true);
                } catch { /* ignore */ }
              }}
              className="text-purple-300 font-semibold hover:text-purple-200"
            >
              UNDO
            </button>
          </span>
        )
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const restoreNote = async (note: Note) => {
    try {
      await axios.post(`${apiBase}/notes/${note._id}/restore`, {}, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success('Note restored');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const deleteForever = async (note: Note) => {
    if (!confirm('Permanently delete this note? This cannot be undone.')) return;
    try {
      await axios.delete(`${apiBase}/notes/${note._id}/permanent`, authHeaders);
      setNotes(prev => prev.filter(n => n._id !== note._id));
      toast.success('Note deleted forever');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const emptyTrash = async () => {
    if (notes.length === 0) return;
    if (!confirm(`Permanently delete all ${notes.length} note(s) in trash? This cannot be undone.`)) return;
    const toastId = toast.loading('Emptying trash...');
    try {
      await Promise.all(notes.map(n => axios.delete(`${apiBase}/notes/${n._id}/permanent`, authHeaders)));
      setNotes([]);
      toast.success('Trash emptied', { id: toastId });
    } catch {
      toast.error('Some notes failed to delete', { id: toastId });
      fetchNotes(true);
    }
  };

  const restoreAll = async () => {
    if (notes.length === 0) return;
    const toastId = toast.loading('Restoring all...');
    try {
      await Promise.all(notes.map(n => axios.post(`${apiBase}/notes/${n._id}/restore`, {}, authHeaders)));
      setNotes([]);
      toast.success('All notes restored', { id: toastId });
    } catch {
      toast.error('Some notes failed to restore', { id: toastId });
      fetchNotes(true);
    }
  };

  const toggleChecklistItem = async (note: Note, index: number) => {
    const updated = [...(note.checklist || [])];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    setNotes(prev => prev.map(n => (n._id === note._id ? { ...n, checklist: updated } : n)));
    try {
      await axios.put(`${apiBase}/notes/${note._id}`, { checklist: updated }, authHeaders);
    } catch {
      toast.error('Failed to update checklist');
      fetchNotes(true);
    }
  };

  // Inline edit handlers
  const startEdit = (note: Note) => {
    if (activeView !== 'notes') return;
    setEditingNoteId(note._id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color || '#1c1b29');
    setEditTextColor(note.textColor || '#ffffff');
    setEditChecklist(note.checklist || []);
    setEditLabels(note.labels || []);
    setEditReminder(note.reminder || '');
    setEditLabelInput('');
    setEditChecklistInput('');
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
  };

  const saveEdit = async () => {
    if (!editingNoteId) return;
    const note = notes.find(n => n._id === editingNoteId);
    if (!note) return;

    const changed =
      editTitle.trim() !== note.title ||
      editContent.trim() !== note.content ||
      editColor !== note.color ||
      editTextColor !== (note.textColor || '#ffffff') ||
      JSON.stringify(editChecklist) !== JSON.stringify(note.checklist || []) ||
      JSON.stringify(editLabels) !== JSON.stringify(note.labels || []) ||
      editReminder !== (note.reminder || '');

    if (changed) {
      try {
        const { data } = await axios.put(
          `${apiBase}/notes/${editingNoteId}`,
          {
            title: editTitle.trim(),
            content: editContent.trim(),
            color: editColor,
            textColor: editTextColor,
            checklist: editChecklist,
            labels: editLabels,
            reminder: editReminder || undefined,
          },
          authHeaders
        );
        setNotes(prev => prev.map(n => (n._id === editingNoteId ? { ...n, ...data.note } : n)));
        toast.success('Note updated');
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to save changes');
      }
    }
    setEditingNoteId(null);
  };

  useEffect(() => {
    if (!editingNoteId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelEdit();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveEdit();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingNoteId, saveEdit]);

  const addEditChecklistItem = () => {
    if (!editChecklistInput.trim()) return;
    setEditChecklist(prev => [...prev, { text: editChecklistInput.trim(), checked: false }]);
    setEditChecklistInput('');
  };

  const toggleEditChecklistItem = (index: number) => {
    setEditChecklist(prev => prev.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it)));
  };

  const removeEditChecklistItem = (index: number) => {
    setEditChecklist(prev => prev.filter((_, i) => i !== index));
  };

  const addEditLabel = (val?: string) => {
    const v = (val ?? editLabelInput).trim();
    if (!v || editLabels.includes(v)) return;
    setEditLabels(prev => [...prev, v]);
    setEditLabelInput('');
  };

  const removeEditLabel = (label: string) => {
    setEditLabels(prev => prev.filter(l => l !== label));
  };

  // Render helper to pass props to NoteCard
  const renderNoteCard = (note: Note) => (
    <NoteCard
      key={note._id}
      note={note}
      activeView={activeView}
      isSuperAdmin={isSuperAdmin}
      editingNoteId={editingNoteId}
      editTitle={editTitle} setEditTitle={setEditTitle}
      editContent={editContent} setEditContent={setEditContent}
      editColor={editColor} setEditColor={setEditColor}
      editTextColor={editTextColor} setEditTextColor={setEditTextColor}
      editChecklist={editChecklist}
      editLabels={editLabels}
      editLabelInput={editLabelInput} setEditLabelInput={setEditLabelInput}
      editChecklistInput={editChecklistInput} setEditChecklistInput={setEditChecklistInput}
      editLabelFocused={editLabelFocused} setEditLabelFocused={setEditLabelFocused}
      editReminder={editReminder} setEditReminder={setEditReminder}
      editTextareaRef={editTextareaRef}
      labelSuggestions={labelSuggestions}
      apiBase={apiBase}
      token={token}
      showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker}
      colorPickerTarget={colorPickerTarget} setColorPickerTarget={setColorPickerTarget}
      startEdit={startEdit}
      cancelEdit={cancelEdit}
      saveEdit={saveEdit}
      togglePin={togglePin}
      changeColor={changeColor}
      archiveNote={archiveNote}
      trashNote={trashNote}
      restoreNote={restoreNote}
      deleteForever={deleteForever}
      toggleChecklistItem={toggleChecklistItem}
      toggleEditChecklistItem={toggleEditChecklistItem}
      removeEditChecklistItem={removeEditChecklistItem}
      addEditChecklistItem={addEditChecklistItem}
      addEditLabel={addEditLabel}
      removeEditLabel={removeEditLabel}
    />
  );

  return (
    <div className="space-y-6 px-1" onClick={() => setShowColorPicker(null)}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Notes
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {isSuperAdmin && <span className="text-purple-300/60 ml-1">· showing all admins' notes</span>}
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <SvgIcon d={ICONS.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-8 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
            >
              <SvgIcon d={ICONS.close} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* View tabs + Creator filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {(['notes', 'archive', 'trash'] as ViewTab[]).map(v => (
            <button
              key={v}
              onClick={() => { setActiveView(v); setLabelFilter(null); setEditingNoteId(null); }}
              className={`rounded-xl border px-4 py-2 text-xs font-medium capitalize transition-all ${
                activeView === v
                  ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                  : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">Created by:</span>
            {(['all', 'admin', 'subadmin'] as CreatorFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { setCreatorFilter(f); setEditingNoteId(null); }}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium capitalize transition-all flex items-center gap-1 ${
                  creatorFilter === f
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                    : 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                }`}
              >
                {f === 'all' && <SvgIcon d={ICONS.all} className="w-3 h-3" />}
                {f === 'admin' && <SvgIcon d={ICONS.admin} className="w-3 h-3" />}
                {f === 'subadmin' && <SvgIcon d={ICONS.user} className="w-3 h-3" />}
                {f}
              </button>
            ))}
          </div>
        )}

        {activeView === 'trash' && notes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={restoreAll}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
            >
              <SvgIcon d={ICONS.restoreAll} className="w-3.5 h-3.5" />
              Restore all
            </button>
            <button
              onClick={emptyTrash}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20 transition-all"
            >
              <SvgIcon d={ICONS.emptyTrash} className="w-3.5 h-3.5" />
              Empty trash
            </button>
          </div>
        )}
      </div>

      {/* Label filter chips */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <SvgIcon d={ICONS.tag} className="w-3.5 h-3.5 text-white/30" />
          {allLabels.map(([l, count]) => (
            <button
              key={l}
              onClick={() => { setLabelFilter(labelFilter === l ? null : l); setEditingNoteId(null); }}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                labelFilter === l
                  ? 'border-purple-500/50 bg-purple-500/15 text-purple-200'
                  : 'border-white/10 bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              {l}
              <span className="text-white/30">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      {activeView === 'notes' && (
        <div className="max-w-xl mx-auto sm:mx-0" onClick={(e) => e.stopPropagation()}>
          {!composerOpen ? (
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40 hover:border-white/20 hover:bg-white/[0.05] transition-all flex items-center gap-2"
            >
              <SvgIcon d={ICONS.plus} className="w-4 h-4" />
              Take a note...
            </button>
          ) : (
            <div
              ref={composerRef}
              className="rounded-2xl border border-purple-500/40 p-4 space-y-3 shadow-2xl shadow-purple-900/20 animate-[popIn_0.15s_ease]"
              style={{ backgroundColor: composerColor }}
            >
              <input
                type="text"
                value={composerTitle}
                onChange={e => setComposerTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                className="w-full bg-transparent text-sm font-semibold outline-none"
                style={{ color: composerTextColor }}
              />
              <textarea
                value={composerContent}
                onChange={e => setComposerContent(e.target.value)}
                placeholder="Take a note..."
                rows={3}
                className="w-full bg-transparent text-xs outline-none resize-none"
                style={{ color: composerTextColor }}
              />

              {composerShowChecklist && (
                <div className="space-y-1.5">
                  {composerChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: composerTextColor }}>
                      <SvgIcon d={ICONS.check} className="w-3 h-3 text-emerald-400" />
                      <span className="flex-1">{item.text}</span>
                      <button onClick={() => setComposerChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-white/30 hover:text-red-400">
                        <SvgIcon d={ICONS.close} className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <SvgIcon d={ICONS.plusSmall} className="w-3.5 h-3.5 text-white/30" />
                    <input
                      type="text"
                      value={composerChecklistInput}
                      onChange={e => setComposerChecklistInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComposerChecklistItem())}
                      placeholder="List item"
                      autoFocus
                      className="flex-1 bg-transparent text-[11px] outline-none"
                      style={{ color: composerTextColor, opacity: 0.6 }}
                    />
                  </div>
                </div>
              )}

              {composerLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {composerLabels.map(l => (
                    <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 flex items-center gap-1" style={{ color: composerTextColor, opacity: 0.6 }}>
                      {l}
                      <button onClick={() => setComposerLabels(prev => prev.filter(x => x !== l))}>
                        <SvgIcon d={ICONS.close} className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={composerLabelInput}
                  onChange={e => setComposerLabelInput(e.target.value)}
                  onFocus={() => setComposerLabelFocused(true)}
                  onBlur={() => setTimeout(() => setComposerLabelFocused(false), 150)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComposerLabel())}
                  placeholder="+ Add label (press Enter)"
                  className="w-full bg-transparent text-[11px] outline-none"
                  style={{ color: composerTextColor, opacity: 0.6 }}
                />
                {composerLabelFocused && composerLabelInput.trim() && (
                  <div className="absolute z-20 top-6 left-0 w-full bg-[#1a1926] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {labelSuggestions
                      .filter(l => l.toLowerCase().includes(composerLabelInput.toLowerCase()) && !composerLabels.includes(l))
                      .slice(0, 5)
                      .map(l => (
                        <button
                          key={l}
                          onMouseDown={() => addComposerLabel(l)}
                          className="block w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
                        >
                          {l}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Reminder — no input shown until user opts in, so no dd-mm-yyyy placeholder */}
              <div className="flex items-center gap-2 flex-wrap pt-1" onClick={(e) => e.stopPropagation()}>
                <SvgIcon d={ICONS.clock} className="w-4 h-4 text-white/50" />
                {composerReminder ? (
                  <>
                    <input
                      type="datetime-local"
                      value={composerReminder}
                      onChange={e => setComposerReminder(e.target.value)}
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-purple-500/50"
                      style={{ color: composerTextColor }}
                    />
                    <button
                      onClick={() => setComposerReminder('')}
                      className="text-white/30 hover:text-red-400 transition-colors"
                      title="Clear reminder"
                    >
                      <SvgIcon d={ICONS.clear} className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setComposerReminder(new Date(Date.now() + 3600000).toISOString().slice(0, 16))}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    + Add reminder
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <div className="flex items-center gap-1 pt-2">
                  <button
                    onClick={() => setComposerShowChecklist(v => !v)}
                    className={`p-1.5 rounded-lg transition-colors ${composerShowChecklist ? 'text-emerald-300 bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                    title="Toggle checklist"
                  >
                    <SvgIcon d={ICONS.checkbox} className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === 'composer' ? null : 'composer')}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                      title="Color"
                    >
                      <SvgIcon d={ICONS.palette} className="w-4 h-4" />
                    </button>
                    {showColorPicker === 'composer' && (
                      <ColorPickerPopover
                        targetColor={colorPickerTarget === 'bg' ? composerColor : composerTextColor}
                        onChange={(col) => {
                          if (colorPickerTarget === 'bg') setComposerColor(col);
                          else setComposerTextColor(col);
                        }}
                        target={colorPickerTarget}
                        setTarget={setColorPickerTarget}
                      />
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={resetComposer} className="px-3 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/5">
                    Cancel
                  </button>
                  <button onClick={saveComposerNote} className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {[180, 120, 220, 140, 160, 100, 200, 130].map((h, i) => <SkeletonCard key={i} h={h} />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-3">
          <StickyNoteIcon className="w-14 h-14" />
          <p className="text-sm">
            {search
              ? 'No notes match your search'
              : activeView === 'trash' ? 'Trash is empty'
              : activeView === 'archive' ? 'No archived notes'
              : 'No notes yet — start typing above'}
          </p>
        </div>
      ) : (
        <>
          {editingNoteId && (
            <div className="mb-4">
              {notes.find(n => n._id === editingNoteId) && renderNoteCard(notes.find(n => n._id === editingNoteId)!)}
            </div>
          )}

          {(() => {
            const filtered = notes.filter(n => n._id !== editingNoteId);
            const pinned = filtered.filter(n => n.pinned);
            const others = filtered.filter(n => !n.pinned);
            const hasPinned = pinned.length > 0 && activeView === 'notes';
            return (
              <>
                {hasPinned && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1.5">
                      <SvgIcon d={ICONS.pin} className="w-3 h-3" fill /> Pinned
                    </p>
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                      {pinned.map(n => renderNoteCard(n))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    {hasPinned && <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2 mt-4">Others</p>}
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                      {others.map(n => renderNoteCard(n))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default NotesManager;