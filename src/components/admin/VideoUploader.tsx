 import React, { useState, useRef, useEffect } from 'react';

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

// ✅ CORS policy required for direct upload
const CORS_POLICY = JSON.stringify([
  {
    "AllowedOrigins": ["https://animebing.in"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
], null, 2);

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

  const pauseRef = useRef(false);
  const stateRef = useRef<UploadState | null>(null);

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/uploads/buckets`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setBuckets(data))
      .catch(() => {});
  }, []);

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

    try {
      let state = loadState(file.name);

      if (!state) {
        const { uploadId, key } = await apiCall('/initiate', { hostname: selectedHostname, filename: file.name });
        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        state = { hostname: selectedHostname, key, uploadId, totalParts, fileSize: file.size, fileName: file.name, completedParts: [] };
        saveState(state);
      }

      stateRef.current = state;

      for (let partNumber = 1; partNumber <= state.totalParts; partNumber++) {
        if (pauseRef.current) { setStatus('paused'); return; }

        const alreadyDone = state.completedParts.find(p => p.partNumber === partNumber);
        if (alreadyDone) {
          setProgress(Math.round((state.completedParts.length / state.totalParts) * 100));
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

        setProgress(Math.round((state.completedParts.length / state.totalParts) * 100));
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
    setStatus('idle'); setProgress(0); setFile(null);
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

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <span className="w-1.5 h-5 bg-purple-400 rounded-full"></span>
        Video Upload (Direct to R2)
      </h3>

      {/* ─── CORS Setup (Collapsible) ─── */}
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
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm">{error}</div>
      )}

      {/* ─── Bucket Selection ─── */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-300 mb-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M9 12h6" />
          </svg>
          Select Bucket
        </label>
        <div className="relative">
          <select
            value={selectedHostname}
            onChange={e => setSelectedHostname(e.target.value)}
            disabled={status === 'uploading'}
            className="w-full appearance-none px-4 py-2.5 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition disabled:opacity-50"
          >
            <option value="">-- Select Bucket --</option>
            {buckets.map(b => (
              <option key={b.hostname} value={b.hostname} className="bg-gray-800 text-white">
                {b.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1">Video File</label>
        <input
          type="file" accept="video/*" disabled={status === 'uploading'}
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-white/80"
        />
      </div>

      {status !== 'idle' && (
        <div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/60 mt-1">{progress}% — {status}</p>
        </div>
      )}

      {finalUrl && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <p className="text-xs text-emerald-200 mb-1">Upload complete! URL:</p>
          <code className="text-xs text-white break-all">{finalUrl}</code>
          <button onClick={() => navigator.clipboard.writeText(finalUrl)} className="ml-2 text-xs px-2 py-1 bg-purple-600/40 hover:bg-purple-600/60 rounded">
            Copy
          </button>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {status !== 'uploading' && status !== 'done' && (
          <button onClick={startOrResumeUpload} disabled={!file || !selectedHostname}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {status === 'paused' ? 'Resume Upload' : 'Start Upload'}
          </button>
        )}
        {status === 'uploading' && (
          <button onClick={handlePause} className="px-5 py-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-xl text-sm font-medium">
            Pause
          </button>
        )}
        {(status === 'uploading' || status === 'paused') && (
          <button onClick={handleCancel} className="px-5 py-2 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded-xl text-sm font-medium">
            Cancel
          </button>
        )}
        {status === 'done' && (
          <button onClick={() => { setStatus('idle'); setFile(null); setFinalUrl(''); setProgress(0); }}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium">
            Upload Another
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;