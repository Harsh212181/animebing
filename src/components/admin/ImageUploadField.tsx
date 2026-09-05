 import React, { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Props {
  value: string;
  onChange: (url: string) => void;
  token?: string;
}

const ImageUploadField: React.FC<Props> = ({ value, onChange, token: tokenProp }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const token = resolveToken();
      const initRes = await fetch(`${API_BASE}/uploads/image-presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ filename: file.name }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || 'Presign failed');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', initData.uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Upload failed'));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      onChange(initData.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) uploadFile(f);
    else setError('Please drop a valid image file');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleSaveLink = () => {
    if (!linkInput.trim()) {
      setError('Please enter a link');
      return;
    }
    onChange(linkInput.trim());
    setShowLinkInput(false);
    setLinkInput('');
    setError('');
  };

  const handleCancelLink = () => {
    setShowLinkInput(false);
    setLinkInput('');
  };

  return (
    <div>
      {error && <div className="mb-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-200 text-xs">{error}</div>}

      {/* Outer container without fixed width, so children can expand */}
      <div className="flex flex-col gap-2">
        {/* Preview box — 100px fixed width */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative bg-slate-900/50 rounded-xl overflow-hidden border-2 w-[100px] h-[150px] cursor-pointer transition-all ${
            isDragOver
              ? 'border-purple-500 ring-2 ring-purple-500/40 bg-purple-500/10'
              : 'border-dashed border-slate-700/60 hover:border-slate-500'
          } ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {value ? (
            <img
              src={value}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-700/50 to-slate-800/50 px-2 text-center">
              <svg className={`w-6 h-6 mb-1 transition-colors ${isDragOver ? 'text-purple-300' : 'text-slate-500 opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className={`text-[9px] leading-tight ${isDragOver ? 'text-purple-200' : 'text-slate-400'}`}>
                {isDragOver ? 'Drop here' : 'Click to upload'}
              </span>
            </div>
          )}
          {value && !uploading && (
            <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isDragOver ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
              <span className="text-white text-[9px] font-medium px-1 text-center">
                {isDragOver ? 'Drop to replace' : 'Click / Drop'}
              </span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{progress}%</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
        </div>

        {/* Link section — full width, expands left-right */}
        {!showLinkInput ? (
          <button
            type="button"
            onClick={() => setShowLinkInput(true)}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-lg py-1.5 text-[9px] font-medium transition-colors"
          >
            Add External Link
          </button>
        ) : (
          <div className="flex flex-col gap-1 w-full">
            <input
              type="url"
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              placeholder="Paste link here..."
              className="w-full bg-slate-900/80 border border-purple-500/50 text-white rounded-lg px-2 py-1.5 text-[9px] focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-500"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSaveLink}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md px-1 py-1 text-[8px] font-medium transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelLink}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md px-1 py-1 text-[8px] font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadField;