 import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per part

interface BucketOption { hostname: string; label: string; }

interface UploadState {
  hostname: string;
  key: string;
  uploadId: string;
  totalParts: number;
  fileSize: number;
  fileName: string;
  completedParts: { partNumber: number; eTag: string }[];
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

// ─── Custom Select (portal-based, improved UI) ───
interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  color?: string;
}

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
      <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
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

// ─── File Dropzone ───
const FileDropzone: React.FC<{
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
}> = ({ file, onFileSelect, onFileRemove, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      onFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">Video File</label>
      {!file ? (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-700 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/60'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-300 mb-1">
            <span className="text-purple-400 font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">MP4, MKV, AVI up to large size (chunked upload)</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
          </div>
          <button
            onClick={onFileRemove}
            disabled={disabled}
            className="text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
            aria-label="Remove file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main VideoUploader Component ───
const VideoUploader: React.FC<Props> = ({ token: tokenProp, onUploadComplete }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [selectedHostname, setSelectedHostname] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'paused' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [corsExpanded, setCorsExpanded] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes per second
  const [elapsedTime, setElapsedTime] = useState(0);

  const pauseRef = useRef(false);
  const stateRef = useRef<UploadState | null>(null);
  const uploadStartTimeRef = useRef<number | null>(null);
  const lastProgressRef = useRef<{ time: number; bytes: number } | null>(null);

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/uploads/buckets`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setBuckets(data))
      .catch(() => {});
  }, []);

  // Speed calculator interval
  useEffect(() => {
    if (status !== 'uploading') return;
    uploadStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      if (lastProgressRef.current) {
        const now = Date.now();
        const dt = (now - lastProgressRef.current.time) / 1000;
        if (dt > 0) {
          const speed = (progress - lastProgressRef.current.bytes) / dt;
          setUploadSpeed(speed > 0 ? speed : 0);
        }
      }
      setElapsedTime(Math.floor((Date.now() - (uploadStartTimeRef.current || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, progress]);

  const storageKey = (name: string) => `upload_state_${name}`;
  const saveState = (state: UploadState) => {
    stateRef.current = state;
    localStorage.setItem(storageKey(state.fileName), JSON.stringify(state));
  };
  const loadState = (name: string): UploadState | null => {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? JSON.parse(raw) : null;
  };
  const clearState = (name: string) => localStorage.removeItem(storageKey(name));

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

  const startOrResumeUpload = async () => {
    if (!file || !selectedHostname) {
      setError('File aur bucket dono select karo');
      return;
    }
    setError('');
    setStatus('uploading');
    pauseRef.current = false;
    uploadStartTimeRef.current = Date.now();
    lastProgressRef.current = { time: Date.now(), bytes: 0 };

    try {
      let state = loadState(file.name);

      if (!state) {
        const { uploadId, key } = await apiCall('/initiate', { hostname: selectedHostname, filename: file.name });
        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        state = { hostname: selectedHostname, key, uploadId, totalParts, fileSize: file.size, fileName: file.name, completedParts: [] };
        saveState(state);
      }

      stateRef.current = state;
      const totalBytes = file.size;

      for (let partNumber = 1; partNumber <= state.totalParts; partNumber++) {
        if (pauseRef.current) { setStatus('paused'); return; }

        const alreadyDone = state.completedParts.find(p => p.partNumber === partNumber);
        if (alreadyDone) {
          const completedBytes = state.completedParts.length * CHUNK_SIZE;
          setProgress(Math.min(100, Math.round((completedBytes / totalBytes) * 100)));
          lastProgressRef.current = { time: Date.now(), bytes: completedBytes };
          continue;
        }

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const { url } = await apiCall('/part-url', {
          hostname: state.hostname, key: state.key, uploadId: state.uploadId, partNumber
        });

        const putRes = await fetch(url, { method: 'PUT', body: chunk });
        if (!putRes.ok) throw new Error(`Part ${partNumber} upload failed`);

        const eTag = putRes.headers.get('ETag') || '';
        state.completedParts.push({ partNumber, eTag });
        saveState(state);

        const completedBytes = state.completedParts.length * CHUNK_SIZE;
        const newProgress = Math.min(100, Math.round((completedBytes / totalBytes) * 100));
        setProgress(newProgress);
        lastProgressRef.current = { time: Date.now(), bytes: completedBytes };
      }

      const { url: completedUrl } = await apiCall('/complete', {
        hostname: state.hostname, key: state.key, uploadId: state.uploadId, parts: state.completedParts
      });

      clearState(file.name);
      setFinalUrl(completedUrl);
      setStatus('done');
      onUploadComplete?.(completedUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload fail ho gaya');
      setStatus('error');
    }
  };

  const handlePause = () => { pauseRef.current = true; };

  const handleCancel = async () => {
    const state = stateRef.current;
    if (state) {
      try { await apiCall('/abort', { hostname: state.hostname, key: state.key, uploadId: state.uploadId }); } catch {}
      clearState(state.fileName);
    }
    setStatus('idle'); setProgress(0); setFile(null); setUploadSpeed(0); setElapsedTime(0);
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

  const bucketOptions: SelectOption[] = buckets.map(b => ({
    value: b.hostname,
    label: b.label,
  }));

  const formatSpeed = (speed: number) => {
    if (speed > 1024 * 1024) return (speed / (1024 * 1024)).toFixed(2) + ' MB/s';
    if (speed > 1024) return (speed / 1024).toFixed(1) + ' KB/s';
    return speed.toFixed(0) + ' B/s';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
          <p className="text-xs text-white/40">Resumable chunked upload to Cloudflare R2</p>
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

            <pre className="bg-black/40 p-3 rounded-lg text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {CORS_POLICY}
            </pre>

            <button
              onClick={copyCorsPolicy}
              className="px-4 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-100 rounded-lg text-xs font-medium transition"
            >
              {copied ? '✅ Copied!' : '📋 Copy CORS JSON'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Bucket Selection */}
      <CustomSelect
        label="Select Bucket"
        value={selectedHostname}
        onChange={(val) => setSelectedHostname(val)}
        options={bucketOptions}
        icon={
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M9 12h6" />
          </svg>
        }
        disabled={status === 'uploading'}
      />

      {/* File Dropzone */}
      <FileDropzone
        file={file}
        onFileSelect={setFile}
        onFileRemove={() => { setFile(null); setProgress(0); setStatus('idle'); }}
        disabled={status === 'uploading'}
      />

      {/* Progress / Status */}
      {(status === 'uploading' || status === 'paused' || status === 'done') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70 font-medium">
              {status === 'uploading' && 'Uploading...'}
              {status === 'paused' && 'Paused'}
              {status === 'done' && 'Completed'}
            </span>
            <span className="text-purple-300 font-semibold">{progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {status === 'uploading' && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatSpeed(uploadSpeed)}</span>
              <span>{formatTime(elapsedTime)} elapsed</span>
            </div>
          )}
        </div>
      )}

      {/* Final URL */}
      {finalUrl && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-200 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-semibold">Upload complete!</span>
          </div>
          <code className="text-xs text-white break-all">{finalUrl}</code>
          <button
            onClick={() => navigator.clipboard.writeText(finalUrl)}
            className="mt-2 text-xs px-3 py-1 bg-purple-600/40 hover:bg-purple-600/60 rounded-lg transition"
          >
            Copy URL
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {status !== 'uploading' && status !== 'done' && (
          <button
            onClick={startOrResumeUpload}
            disabled={!file || !selectedHostname}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-lg shadow-purple-600/20 transition-all"
          >
            {status === 'paused' ? 'Resume Upload' : 'Start Upload'}
          </button>
        )}
        {status === 'uploading' && (
          <button
            onClick={handlePause}
            className="px-5 py-2.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-xl text-sm font-medium transition"
          >
            Pause
          </button>
        )}
        {(status === 'uploading' || status === 'paused') && (
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded-xl text-sm font-medium transition"
          >
            Cancel
          </button>
        )}
        {status === 'done' && (
          <button
            onClick={() => { setStatus('idle'); setFile(null); setFinalUrl(''); setProgress(0); setUploadSpeed(0); setElapsedTime(0); }}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition"
          >
            Upload Another
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;