 import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per part
const MAX_CONCURRENT_UPLOADS = 2;   // how many files upload at the same time (like Cyberduck's queue)

interface BucketOption { hostname: string; label: string; }

interface PersistedState {
  hostname: string;
  key: string;
  uploadId: string;
  totalParts: number;
  fileSize: number;
  fileName: string;
  completedParts: { partNumber: number; eTag: string }[];
}

type ItemStatus = 'needs-file' | 'queued' | 'uploading' | 'paused' | 'done' | 'error';

interface UploadItem {
  id: string;
  hostname: string;
  fileName: string;
  fileSize: number;
  file: File | null;
  status: ItemStatus;
  progress: number; // 0-100
  error?: string;
  finalUrl?: string;
  uploadId?: string;
  key?: string;
  totalParts?: number;
  completedParts: { partNumber: number; eTag: string }[];
  speed: number; // bytes/sec
}

interface Props {
  token?: string;
  onUploadComplete?: (url: string) => void;
}

// ─── CORS policy ───
const CORS_POLICY = JSON.stringify([
  {
    "AllowedOrigins": ["https://animebing.in"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
], null, 2);

const storageKey = (fileName: string, fileSize: number) => `upload_state_${fileName}__${fileSize}`;

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (speed: number) => {
  if (!speed || speed <= 0) return '';
  if (speed > 1024 * 1024) return (speed / (1024 * 1024)).toFixed(2) + ' MB/s';
  if (speed > 1024) return (speed / 1024).toFixed(1) + ' KB/s';
  return speed.toFixed(0) + ' B/s';
};

// ─── Custom Select (portal-based) ───
interface SelectOption { value: string; label: string; hint?: string; color?: string; }

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
  disabled?: boolean;
}> = ({ value, onChange, options, icon, label, required, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const maxListHeight = 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < maxListHeight && rect.top > maxListHeight;
    setCoords({
      top: openUpward ? rect.top + window.scrollY - maxListHeight - 6 : rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen, updatePosition]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={triggerRef} className="relative">
      <label className="block text-xs font-medium text-slate-300 mb-1.5 flexl items-center gap-1.5">
        {icon}
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(v => !v)}
        disabled={disabled}
        className={`w-full bg-gray-800/80 border text-white rounded-xl px-4 py-3 text-sm text-left transition-all flex items-center justify-between gap-2 shadow-sm ${
          isOpen ? 'border-purple-500/60 ring-2 ring-purple-500/20' : 'border-gray-700 hover:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selected.color} flex-shrink-0`} />}
          <span className="truncate font-medium">{selected?.label || 'Select...'}</span>
        </span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
          className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 py-2 max-h-72 overflow-y-auto animate-fadeIn [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-600/20 text-purple-200' : 'text-slate-300 hover:bg-gray-700'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${opt.color} flex-shrink-0`} />}
                  <span className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{opt.label}</span>
                    {opt.hint && <span className="text-[11px] text-slate-500 truncate">{opt.hint}</span>}
                  </span>
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Multi-file Dropzone ───
const MultiFileDropzone: React.FC<{
  onFilesSelected: (files: File[]) => void;
}> = ({ onFilesSelected }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVideoLike = (f: File) =>
    f.type.startsWith('video/') || /\.(mp4|mkv|avi|mov|webm|m4v|ts)$/i.test(f.name);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(isVideoLike);
    if (files.length) onFilesSelected(files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">Video File(s)</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragOver ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/60'
        }`}
      >
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-300 mb-1">
          <span className="text-purple-400 font-medium">Click to upload</span> or drag and drop — select multiple files to upload them together
        </p>
        <p className="text-xs text-gray-500">MP4, MKV, AVI up to large size (chunked, resumable upload)</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) onFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

// ─── Status badge ───
const StatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    'needs-file': { label: 'Needs file', cls: 'bg-amber-600/30 text-amber-200 border-amber-500/40' },
    queued: { label: 'Queued', cls: 'bg-gray-600/30 text-gray-200 border-gray-500/40' },
    uploading: { label: 'Uploading', cls: 'bg-blue-600/30 text-blue-200 border-blue-500/40' },
    paused: { label: 'Paused', cls: 'bg-amber-600/30 text-amber-200 border-amber-500/40' },
    done: { label: 'Done', cls: 'bg-emerald-600/30 text-emerald-200 border-emerald-500/40' },
    error: { label: 'Error', cls: 'bg-rose-600/30 text-rose-200 border-rose-500/40' },
  };
  const s = map[status];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${s.cls}`}>{s.label}</span>;
};

// ─── One row per upload in the queue ───
const UploadRow: React.FC<{
  item: UploadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onAttachFile: (file: File) => void;
  onCopyUrl: () => void;
}> = ({ item, onPause, onResume, onCancel, onRetry, onAttachFile, onCopyUrl }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState('');

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.name !== item.fileName || f.size !== item.fileSize) {
      setMismatch(`Yeh file match nahi hui — "${item.fileName}" (${formatSize(item.fileSize)}) chuno.`);
      return;
    }
    setMismatch('');
    onAttachFile(f);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{item.fileName}</p>
          <p className="text-xs text-gray-400">{formatSize(item.fileSize)} · <span className="text-purple-300">{item.hostname}</span></p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.status !== 'needs-file' && (
        <>
          <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>{item.progress}%</span>
            {item.status === 'uploading' && <span>{formatSpeed(item.speed)}</span>}
          </div>
        </>
      )}

      {item.status === 'needs-file' && (
        <div className="space-y-2">
          <p className="text-xs text-amber-200/80">
            Interrupted upload — {item.progress}% already uploaded. Isi naam/size ki file dobara select karo to continue karne ke liye.
          </p>
          {mismatch && <p className="text-xs text-rose-300">{mismatch}</p>}
          <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 rounded-full bg-amber-500/60" style={{ width: `${item.progress}%` }} />
          </div>
        </div>
      )}

      {item.error && <p className="text-xs text-rose-300">{item.error}</p>}

      {item.status === 'done' && item.finalUrl && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <code className="text-[11px] text-white break-all">{item.finalUrl}</code>
        </div>
      )}

      {item.status === 'done' && !item.finalUrl && (
        <p className="text-xs text-amber-200/80">
          Upload ho gaya, par Public URL set nahi hai. My Storage me jaake set karo.
        </p>
      )}

      <div className="flex gap-2 flex-wrap pt-1">
        {item.status === 'needs-file' && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-medium"
            >
              Select File to Resume
            </button>
            <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handlePick} />
            <button onClick={onCancel} className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-200 rounded-lg text-xs font-medium">
              Discard
            </button>
          </>
        )}
        {(item.status === 'queued' || item.status === 'uploading') && (
          <>
            <button onClick={onPause} className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-medium">
              Pause
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-medium">
              Cancel
            </button>
          </>
        )}
        {item.status === 'paused' && (
          <>
            <button onClick={onResume} className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 rounded-lg text-xs font-medium">
              Resume
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-medium">
              Cancel
            </button>
          </>
        )}
        {item.status === 'error' && (
          <>
            {item.file && (
              <button onClick={onRetry} className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 rounded-lg text-xs font-medium">
                Retry
              </button>
            )}
            <button onClick={onCancel} className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-200 rounded-lg text-xs font-medium">
              Discard
            </button>
          </>
        )}
        {item.status === 'done' && (
          <>
            <button onClick={onCopyUrl} className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-medium">
              Copy URL
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium">
              Remove from list
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main VideoUploader Component ───
const VideoUploader: React.FC<Props> = ({ token: tokenProp, onUploadComplete }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [selectedHostname, setSelectedHostname] = useState('');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState('');
  const [corsExpanded, setCorsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const itemsRef = useRef<UploadItem[]>([]);
  const activeRef = useRef<Set<string>>(new Set());
  const pauseFlagsRef = useRef<Map<string, boolean>>(new Map());
  const cancelledRef = useRef<Set<string>>(new Set()); // ✅ NEW

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/uploads/buckets`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setBuckets(data))
      .catch(() => {});
  }, []);

  // ✅ On mount: recover any interrupted uploads from a previous session so they
  // don't just silently vanish after a refresh — the user re-attaches the same
  // file and it continues from the last completed part instead of restarting.
  useEffect(() => {
    const recovered: UploadItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('upload_state_')) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const s: PersistedState = JSON.parse(raw);
        if (!s.fileName || !s.fileSize) continue;
        const completedBytes = (s.completedParts?.length || 0) * CHUNK_SIZE;
        const progress = Math.min(99, Math.round((completedBytes / s.fileSize) * 100));
        recovered.push({
          id: k,
          hostname: s.hostname,
          fileName: s.fileName,
          fileSize: s.fileSize,
          file: null,
          status: 'needs-file',
          progress,
          uploadId: s.uploadId,
          key: s.key,
          totalParts: s.totalParts,
          completedParts: s.completedParts || [],
          speed: 0,
        });
      } catch {}
    }
    if (recovered.length) setItems(prev => [...recovered, ...prev]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistState = (state: PersistedState) => {
    localStorage.setItem(storageKey(state.fileName, state.fileSize), JSON.stringify(state));
  };
  const clearPersistedState = (fileName: string, fileSize: number) => {
    localStorage.removeItem(storageKey(fileName, fileSize));
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const apiCall = async (path: string, body: any) => {
    const token = resolveToken();
    const res = await fetch(`${API_BASE}/uploads${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload API error');
    return data;
  };

  const runUpload = useCallback(async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item || !item.file) { activeRef.current.delete(id); return; }

    pauseFlagsRef.current.set(id, false);
    updateItem(id, { status: 'uploading', error: undefined });

    const file = item.file;
    let lastTick = { time: Date.now(), bytes: item.completedParts.length * CHUNK_SIZE };

    try {
      // Resolve into one guaranteed, explicitly-typed object up front. Doing it
      // this way (instead of three separate `let`s reassigned inside an
      // `if (!a || !b || !c)` block) avoids a TS "possibly undefined" error,
      // since TS can't narrow three different optional variables at once
      // across a compound OR condition.
      let session: { uploadId: string; key: string; totalParts: number };
      let completedParts = [...item.completedParts];

      if (item.uploadId && item.key && item.totalParts) {
        session = { uploadId: item.uploadId, key: item.key, totalParts: item.totalParts };
      } else {
        const res = await apiCall('/initiate', { hostname: item.hostname, filename: file.name });
        session = { uploadId: res.uploadId, key: res.key, totalParts: Math.ceil(file.size / CHUNK_SIZE) };
        completedParts = [];
        persistState({ hostname: item.hostname, ...session, fileSize: file.size, fileName: file.name, completedParts });
        updateItem(id, { uploadId: session.uploadId, key: session.key, totalParts: session.totalParts });
      }

      for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
        if (pauseFlagsRef.current.get(id)) {
          updateItem(id, { status: 'paused' });
          activeRef.current.delete(id);
          pump();
          return;
        }

        if (completedParts.find(p => p.partNumber === partNumber)) continue;

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const { url } = await apiCall('/part-url', { hostname: item.hostname, key: session.key, uploadId: session.uploadId, partNumber });
        const putRes = await fetch(url, { method: 'PUT', body: chunk });
        if (!putRes.ok) throw new Error(`Part ${partNumber} upload fail ho gaya`);

        // ✅ NEW: cancel ho chuka hai to state dobara save mat karo
        if (cancelledRef.current.has(id)) return;

        const eTag = putRes.headers.get('ETag') || '';
        completedParts = [...completedParts, { partNumber, eTag }];
        persistState({ hostname: item.hostname, ...session, fileSize: file.size, fileName: file.name, completedParts });

        const completedBytes = completedParts.length * CHUNK_SIZE;
        const now = Date.now();
        const dt = (now - lastTick.time) / 1000;
        const speed = dt > 0 ? Math.max(0, (completedBytes - lastTick.bytes) / dt) : 0;
        lastTick = { time: now, bytes: completedBytes };

        updateItem(id, {
          progress: Math.min(100, Math.round((completedBytes / file.size) * 100)),
          completedParts,
          speed,
        });
      }

      const { url: completedUrl } = await apiCall('/complete', { hostname: item.hostname, key: session.key, uploadId: session.uploadId, parts: completedParts });
      clearPersistedState(file.name, file.size);
      updateItem(id, { status: 'done', progress: 100, finalUrl: completedUrl });
      onUploadComplete?.(completedUrl);
    } catch (err: any) {
      updateItem(id, { status: 'error', error: err.message || 'Upload fail ho gaya' });
    } finally {
      activeRef.current.delete(id);
      pump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUploadComplete]);

  const pump = useCallback(() => {
    const queued = itemsRef.current.filter(it => it.status === 'queued' && it.file);
    let slots = MAX_CONCURRENT_UPLOADS - activeRef.current.size;
    for (const it of queued) {
      if (slots <= 0) break;
      if (activeRef.current.has(it.id)) continue;
      activeRef.current.add(it.id);
      slots--;
      runUpload(it.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runUpload]);

  useEffect(() => { pump(); }, [items, pump]);

  const handleFilesSelected = (files: File[]) => {
    setGlobalError('');
    setItems(prev => {
      const next = [...prev];
      files.forEach(file => {
        // Does this file match a previously interrupted upload waiting to be resumed?
        const matchIdx = next.findIndex(it =>
          it.status === 'needs-file' && it.fileName === file.name && it.fileSize === file.size
        );
        if (matchIdx >= 0) {
          next[matchIdx] = { ...next[matchIdx], file, status: 'queued' };
          return;
        }

        // Skip if this exact file is already active in the list.
        const dupe = next.find(it =>
          it.fileName === file.name && it.fileSize === file.size &&
          (it.status === 'queued' || it.status === 'uploading' || it.status === 'paused')
        );
        if (dupe) return;

        if (!selectedHostname) {
          setGlobalError('Pehle ek bucket select karo, phir video daalo.');
          return;
        }

        next.push({
          id: `${file.name}__${file.size}__${Date.now()}__${Math.random().toString(36).slice(2, 7)}`,
          hostname: selectedHostname,
          fileName: file.name,
          fileSize: file.size,
          file,
          status: 'queued',
          progress: 0,
          completedParts: [],
          speed: 0,
        });
      });
      return next;
    });
  };

  const handlePause = (id: string) => pauseFlagsRef.current.set(id, true);
  const handleResume = (id: string) => updateItem(id, { status: 'queued' });
  const handleRetry = (id: string) => updateItem(id, { status: 'queued', error: undefined });

  const handleAttachFile = (id: string, file: File) => {
    updateItem(id, { file, status: 'queued' });
  };

  const handleCancel = async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item) return;

    // 1) running loop ko rokne ka signal
    pauseFlagsRef.current.set(id, true);
    cancelledRef.current.add(id);
    activeRef.current.delete(id);

    // 2) pehle localStorage + UI saaf karo (abort ka wait nahi)
    clearPersistedState(item.fileName, item.fileSize);
    localStorage.removeItem(item.id); // recovered items ki id hi storage key hoti hai
    setItems(prev => prev.filter(it => it.id !== id));

    // 3) R2 me incomplete multipart abort, background me
    if (item.uploadId && item.key && item.status !== 'done') {
      try { await apiCall('/abort', { hostname: item.hostname, key: item.key, uploadId: item.uploadId }); } catch {}
    }
  };

  const copyCorsPolicy = async () => {
    try {
      await navigator.clipboard.writeText(CORS_POLICY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const bucketOptions: SelectOption[] = buckets.map(b => ({ value: b.hostname, label: b.label }));

  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/20 rounded-xl">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Video Upload (Direct to R2)</h3>
          <p className="text-xs text-white/40">Resumable, chunked, multi-file upload to Cloudflare R2 — up to {MAX_CONCURRENT_UPLOADS} at once</p>
        </div>
      </div>

      {/* CORS Setup */}
      <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl overflow-hidden">
        <button
          onClick={() => setCorsExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-500/10 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <svg className={`w-4 h-4 transition-transform ${corsExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            R2 Bucket CORS Setup
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${corsExpanded ? 'bg-amber-500/20 text-amber-200' : 'bg-gray-500/20 text-gray-400'}`}>
            {corsExpanded ? 'Hide' : 'Show'}
          </span>
        </button>

        {corsExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-amber-500/20 space-y-3">
            <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
              <li>Cloudflare Dashboard → R2 → apna bucket select karo (e.g., <code className="text-amber-300">animebing-videos</code>)</li>
              <li>Settings tab → <strong>CORS Policy</strong> section</li>
              <li>Neeche diya JSON copy karke paste karo aur Save karo</li>
            </ol>
            <pre className="bg-black/40 p-3 rounded-lg text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">{CORS_POLICY}</pre>
            <button
              onClick={copyCorsPolicy}
              className="px-4 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-100 rounded-lg text-xs font-medium transition"
            >
              {copied ? '✅ Copied!' : '📋 Copy CORS JSON'}
            </button>
          </div>
        )}
      </div>

      {globalError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {globalError}
        </div>
      )}

      {/* Bucket Selection (used for newly added files) */}
      <CustomSelect
        label="Select Bucket (new files)"
        value={selectedHostname}
        onChange={setSelectedHostname}
        options={bucketOptions}
        icon={
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M9 12h6" />
          </svg>
        }
      />

      {/* Multi-file Dropzone */}
      <MultiFileDropzone onFilesSelected={handleFilesSelected} />

      {/* Upload queue */}
      {items.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/70">Upload Queue ({items.length})</h4>
          {items.map(item => (
            <UploadRow
              key={item.id}
              item={item}
              onPause={() => handlePause(item.id)}
              onResume={() => handleResume(item.id)}
              onCancel={() => handleCancel(item.id)}
              onRetry={() => handleRetry(item.id)}
              onAttachFile={(f) => handleAttachFile(item.id, f)}
              onCopyUrl={() => item.finalUrl && navigator.clipboard.writeText(item.finalUrl)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;