 import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VideoPlayer from '../../../components/VideoPlayer';
import AddToPageModal from './AddToPageModal';

const API_BASE = import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface MediaItem { key: string; size: number; lastModified: string; url: string; hostname: string; }
interface BucketOption { hostname: string; label: string; }
interface Props { token?: string; refreshTrigger?: number; subAdminMode?: boolean; }

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  video:     'M15 10l4.55-2.27a1 1 0 011.45.9v6.74a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  image:     'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  play:      'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  download:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  copy:      'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  edit:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus:      'M12 4v16m8-8H4',
  close:     'M6 18L18 6M6 6l12 12',
  check:     'M5 13l4 4L19 7',
  star:      'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  chevron:   'M19 9l-7 7-7-7',
  warning:   'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  folder:    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  checkbox:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

function itemId(item: MediaItem): string {
  return `${item.hostname}::${item.key}`;
}

// ── Custom Checkbox ─────────────────────────────────────────────────
const CustomCheckbox: React.FC<{
  checked: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ checked, onChange, size = 'md', className = '' }) => {
  const dims = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`${dims} flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-150 ${
        checked
          ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400 shadow-sm shadow-purple-500/40'
          : 'bg-white/[0.04] border-white/[0.14] hover:border-purple-400/60'
      } ${className}`}
    >
      {checked && <SvgIcon d={ICONS.check} className="w-3 h-3 text-white" />}
    </button>
  );
};

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const TITLE_ALIASES: Record<string, string> = {
  'campfire cooking another world': 'campfire cooking',
};

function resolveAlias(normalized: string): string {
  return TITLE_ALIASES[normalized] || normalized;
}

function pickBetterDisplayName(current: string, candidate: string): string {
  const currentHasSpace = /\s/.test(current);
  const candidateHasSpace = /\s/.test(candidate);
  if (candidateHasSpace && !currentHasSpace) return candidate;
  return current;
}

function stripTags(str: string): string {
  return str.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function isImageFile(key: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(key);
}

function parseEpisodeInfo(filename: string): { baseName: string; season: number | null; episode: number | null } {
  const name = stripTags(filename.replace(/\.(mp4|mkv|avi|mov|webm)$/i, ''));
  let baseName = name.trim();
  let season: number | null = null;
  let episode: number | null = null;

  let m = /^(.*?)[\s._-]*S(?:eason)?[\s._-]*(\d{1,2})[\s._-]*E(?:P|p)?[\s._-]*(\d{1,3})/i.exec(name);
  if (m) {
    baseName = m[1].trim().replace(/[\s._-]+$/, '');
    season = parseInt(m[2], 10);
    episode = parseInt(m[3], 10);
  } else {
    m = /^(.*?)[\s._-]*Episode[\s._-]*(\d+)/i.exec(name);
    if (m) {
      baseName = m[1].trim().replace(/[\s._-]+$/, '');
      episode = parseInt(m[2], 10);
    } else {
      m = /^(.*?)[\s._-]*Ep[\s._-]*-?(\d+)/i.exec(name);
      if (m) {
        baseName = m[1].trim().replace(/[\s._-]+$/, '');
        episode = parseInt(m[2], 10);
      } else {
        m = /^(.*?)[\s._-]*E(\d+)(?:[\s._-]|$)/i.exec(name);
        if (m) {
          baseName = m[1].trim().replace(/[\s._-]+$/, '');
          episode = parseInt(m[2], 10);
        }
      }
    }
  }

  if (season === null) {
    const seasonMatch = /^(.*?)[\s._-]*S(?:eason)?[\s._-]*(\d{1,2})$/i.exec(baseName);
    if (seasonMatch) {
      baseName = seasonMatch[1].trim().replace(/[\s._-]+$/, '');
      season = parseInt(seasonMatch[2], 10);
    }
  }

  return { baseName: baseName || name.trim(), season, episode };
}

// ── EpisodeRow ───────────────────────────────────────────────────────
interface EpisodeRowProps {
  item: MediaItem;
  episode: number | null;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (val: string) => void;
  busyKey: string | null;
  isPlaying: boolean;
  isAddingToPage: boolean;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onWatch: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onToggleAddToPage: () => void;
  onRenameStart: () => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}

const EpisodeRow: React.FC<EpisodeRowProps> = ({
  item, episode, isRenaming, renameValue, setRenameValue, busyKey, isPlaying, isAddingToPage,
  selectMode, isSelected, onToggleSelect,
  onWatch, onDownload, onCopy, onToggleAddToPage, onRenameStart, onRenameConfirm, onRenameCancel, onDelete,
}) => {
  const btn = "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all";

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2.5 transition-colors ${
      isSelected ? 'bg-purple-500/10' : 'hover:bg-white/[0.02]'
    }`}>
      <div className="min-w-0 flex-1 flex items-start gap-2.5">
        {selectMode && (
          <CustomCheckbox checked={isSelected} onChange={onToggleSelect} size="sm" className="mt-1" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {episode !== null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25 flex-shrink-0">
                Ep {episode}
              </span>
            )}
            {isRenaming ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="flex-1 min-w-[150px] px-2 py-1 bg-white/[0.04] border border-purple-500/50 rounded-lg text-white text-xs outline-none"
                autoFocus
              />
            ) : (
              <p className="text-xs text-white/90 truncate font-medium">{item.key}</p>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {formatSize(item.size)} · {new Date(item.lastModified).toLocaleString()}
          </p>
          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25">
            {item.hostname}
          </span>
        </div>
      </div>

      {!selectMode && (
        <div className="flex gap-1.5 flex-wrap w-full sm:w-auto">
          {isRenaming ? (
            <>
              <button onClick={onRenameConfirm} disabled={busyKey === item.key + 'rename'}
                className={`${btn} bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/25 text-emerald-300 disabled:opacity-40`}>
                <SvgIcon d={ICONS.check} className="w-3 h-3" /> Save
              </button>
              <button onClick={onRenameCancel}
                className={`${btn} bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-gray-300`}>
                <SvgIcon d={ICONS.close} className="w-3 h-3" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={onWatch} disabled={busyKey === item.key + 'watch'}
                className={`${btn} ${isPlaying
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/25 text-rose-300'
                  : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/25 text-sky-300'} disabled:opacity-40`}>
                <SvgIcon d={ICONS.play} className="w-3 h-3" />
                {busyKey === item.key + 'watch' ? '...' : isPlaying ? 'Close' : 'Watch'}
              </button>
              <button onClick={onDownload} disabled={busyKey === item.key + 'download'}
                className={`${btn} bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/25 text-emerald-300 disabled:opacity-40`}>
                <SvgIcon d={ICONS.download} className="w-3 h-3" />
                {busyKey === item.key + 'download' ? '...' : 'DL'}
              </button>
              <button onClick={onCopy}
                className={`${btn} bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/25 text-purple-300`}>
                <SvgIcon d={ICONS.copy} className="w-3 h-3" /> Copy
              </button>
              <button onClick={onToggleAddToPage}
                className={`${btn} ${isAddingToPage
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/25 text-rose-300'
                  : 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/25 text-indigo-300'}`}>
                <SvgIcon d={ICONS.plus} className="w-3 h-3" />
                {isAddingToPage ? 'Close' : 'Page'}
              </button>
              <button onClick={onRenameStart}
                className={`${btn} bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/25 text-amber-300`}>
                <SvgIcon d={ICONS.edit} className="w-3 h-3" />
              </button>
              <button onClick={onDelete} disabled={busyKey === item.key + 'delete'}
                className={`${btn} bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/25 text-rose-300 disabled:opacity-40`}>
                <SvgIcon d={ICONS.trash} className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── ImageCard ───────────────────────────────────────────────────────
interface ImageCardProps {
  item: MediaItem;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (val: string) => void;
  busyKey: string | null;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onRenameStart: () => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({
  item, isRenaming, renameValue, setRenameValue, busyKey,
  selectMode, isSelected, onToggleSelect,
  onDownload, onCopy, onRenameStart, onRenameConfirm, onRenameCancel, onDelete,
}) => {
  const btn = "flex-1 inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-bold border transition-all";

  return (
    <div
      onClick={() => selectMode && onToggleSelect()}
      className={`group relative rounded-xl overflow-hidden border bg-white/[0.03] transition-colors ${
        isSelected ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-white/[0.06] hover:border-purple-500/30'
      } ${selectMode ? 'cursor-pointer' : ''}`}
    >
      {selectMode && (
        <CustomCheckbox
          checked={isSelected}
          onChange={onToggleSelect}
          size="sm"
          className="absolute top-2 left-2 z-10"
        />
      )}

      <div className="aspect-square bg-black/30 overflow-hidden">
        <img src={item.url} alt={item.key} className="w-full h-full object-cover" loading="lazy" />
      </div>

      <div className="p-2 space-y-1">
        {isRenaming ? (
          <input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            className="w-full px-1.5 py-1 bg-white/[0.04] border border-purple-500/50 rounded-md text-white text-[11px] outline-none"
            autoFocus
          />
        ) : (
          <p className="text-[11px] text-white/90 truncate font-medium" title={item.key}>{item.key}</p>
        )}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <p className="text-[9px] text-gray-500">{formatSize(item.size)}</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25 truncate max-w-[80px]">
            {item.hostname}
          </span>
        </div>
      </div>

      {!selectMode && (
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 focus-within:translate-y-0 transition-transform bg-black/90 backdrop-blur-sm p-1.5 flex gap-1 flex-wrap">
          {isRenaming ? (
            <>
              <button onClick={onRenameConfirm} disabled={busyKey === item.key + 'rename'}
                className={`${btn} bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-500/30 text-emerald-300`}>
                Save
              </button>
              <button onClick={onRenameCancel}
                className={`${btn} bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.1] text-gray-300`}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={onDownload} disabled={busyKey === item.key + 'download'}
                className={`${btn} bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-500/30 text-emerald-300`}>
                {busyKey === item.key + 'download' ? '...' : 'DL'}
              </button>
              <button onClick={onCopy}
                className={`${btn} bg-purple-500/25 hover:bg-purple-500/40 border-purple-500/30 text-purple-300`}>
                Copy
              </button>
              <button onClick={onRenameStart}
                className={`${btn} bg-amber-500/25 hover:bg-amber-500/40 border-amber-500/30 text-amber-300`}>
                Edit
              </button>
              <button onClick={onDelete} disabled={busyKey === item.key + 'delete'}
                className={`${btn} bg-rose-500/25 hover:bg-rose-500/40 border-rose-500/30 text-rose-300`}>
                {busyKey === item.key + 'delete' ? '...' : 'Del'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────
const MediaLibrary: React.FC<Props> = ({ token: tokenProp, refreshTrigger, subAdminMode = false }) => {
  const resolveToken = () =>
    tokenProp || localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';

  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [selectedHostname, setSelectedHostname] = useState('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [markedKeys, setMarkedKeys] = useState<Set<string>>(new Set());
  const [markBusyKey, setMarkBusyKey] = useState<string | null>(null);
  const [markFilter, setMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');
  const [playingItem, setPlayingItem] = useState<{ id: string; url: string } | null>(null);
  const [addToPageRowId, setAddToPageRowId] = useState<string | null>(null);
  const [bulkAddGroupKey, setBulkAddGroupKey] = useState<string | null>(null);
  const [imagesExpanded, setImagesExpanded] = useState(true);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  useEffect(() => {
    const token = resolveToken();
    fetch(`${API_BASE}/uploads/buckets`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setBuckets(data))
      .catch(() => {});
  }, []);

  const fetchMarks = useCallback(async () => {
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/marks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) setMarkedKeys(new Set(data.map((m: any) => m.groupKey)));
    } catch {}
  }, []);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  const apiCall = async (path: string, method: string, body?: any) => {
    const token = resolveToken();
    const res = await fetch(`${API_BASE}/uploads${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const fetchItems = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/uploads/list?hostname=${encodeURIComponent(selectedHostname)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
      else setError(data.error || 'Failed to load');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedHostname]);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshTrigger]);

  const filteredItems = items.filter(i => i.key.toLowerCase().includes(search.toLowerCase()));

  const imageItems = useMemo(() => filteredItems.filter(i => isImageFile(i.key)), [filteredItems]);
  const videoOnlyItems = useMemo(() => filteredItems.filter(i => !isImageFile(i.key)), [filteredItems]);

  const groupedSeries = useMemo(() => {
    const groups = new Map<string, { groupKey: string; displayBaseName: string; season: number | null; entries: { item: MediaItem; episode: number | null }[] }>();

    videoOnlyItems.forEach(item => {
      const { baseName, season, episode } = parseEpisodeInfo(item.key);
      const normalizedBase = resolveAlias(normalizeKey(baseName));
      const groupKey = `${normalizedBase}::${season ?? 'x'}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { groupKey, displayBaseName: baseName, season, entries: [] });
      } else {
        const g = groups.get(groupKey)!;
        g.displayBaseName = pickBetterDisplayName(g.displayBaseName, baseName);
      }
      groups.get(groupKey)!.entries.push({ item, episode });
    });

    const groupArr = Array.from(groups.values()).map(g => {
      g.entries.sort((a, b) => {
        if (a.episode === null && b.episode === null) return 0;
        if (a.episode === null) return 1;
        if (b.episode === null) return -1;
        return a.episode - b.episode;
      });
      const displayName = (g.season !== null && g.season !== 1) ? `${g.displayBaseName} S${g.season}` : g.displayBaseName;
      const latestUpload = Math.max(...g.entries.map(x => new Date(x.item.lastModified).getTime()));

      const eps = g.entries.map(e => e.episode).filter((e): e is number => e !== null);
      let epRange = '';
      if (eps.length > 0) {
        const minEp = Math.min(...eps);
        const maxEp = Math.max(...eps);
        epRange = minEp === maxEp ? `Ep ${minEp}` : `Ep ${minEp}-${maxEp}`;
      }

      return { groupKey: g.groupKey, displayName, episodes: g.entries, latestUpload, epRange };
    });

    groupArr.sort((a, b) => b.latestUpload - a.latestUpload);
    return groupArr;
  }, [videoOnlyItems]);

  const filteredGroups = useMemo(() => {
    if (markFilter === 'all') return groupedSeries;
    if (markFilter === 'marked') return groupedSeries.filter(g => markedKeys.has(g.groupKey));
    if (markFilter === 'unmarked') return groupedSeries.filter(g => !markedKeys.has(g.groupKey));
    return groupedSeries;
  }, [groupedSeries, markedKeys, markFilter]);

  const allVisibleItems = useMemo(() => {
    const fromGroups = filteredGroups.flatMap(g => g.episodes.map(e => e.item));
    return [...imageItems, ...fromGroups];
  }, [imageItems, filteredGroups]);

  const handleWatchOrDownload = async (item: MediaItem, mode: 'watch' | 'download') => {
    const rowId = `${item.hostname}-${item.key}`;

    if (mode === 'watch' && playingItem?.id === rowId) {
      setPlayingItem(null);
      return;
    }

    setBusyKey(item.key + mode);
    try {
      const { url } = await apiCall('/preview-url', 'POST', { hostname: item.hostname, key: item.key, mode });
      if (mode === 'watch') {
        setPlayingItem({ id: rowId, url });
      } else {
        window.open(url, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate link');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopyLink = (item: MediaItem) => {
    if (!item.url) { alert('Public URL set nahi hai. My Storage me set karo.'); return; }
    navigator.clipboard.writeText(item.url);
  };

  const doDelete = async (item: MediaItem) => {
    setBusyKey(item.key + 'delete');
    try {
      await apiCall(`/object?hostname=${encodeURIComponent(item.hostname)}&key=${encodeURIComponent(item.key)}`, 'DELETE');
      setItems(prev => prev.filter(i => !(i.key === item.key && i.hostname === item.hostname)));
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setBusyKey(null);
    }
  };

  const requestDelete = (item: MediaItem) => {
    setConfirmModal({
      title: 'Delete file?',
      message: `"${item.key}" permanently delete karna hai? Yeh undo nahi ho sakta.`,
      confirmLabel: 'Delete',
      onConfirm: () => doDelete(item),
    });
  };

  const startRename = (item: MediaItem) => {
    setRenamingKey(item.key);
    setRenameValue(item.key);
  };

  const confirmRename = async (item: MediaItem) => {
    if (!renameValue.trim() || renameValue === item.key) {
      setRenamingKey(null);
      return;
    }
    setBusyKey(item.key + 'rename');
    try {
      const { url } = await apiCall('/rename', 'POST', { hostname: item.hostname, oldKey: item.key, newKey: renameValue.trim() });
      setItems(prev => prev.map(i =>
        (i.key === item.key && i.hostname === item.hostname)
          ? { ...i, key: renameValue.trim(), url }
          : i
      ));
      setRenamingKey(null);
    } catch (err: any) {
      alert(err.message || 'Rename failed');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleMark = async (groupKey: string, displayName: string) => {
    const token = resolveToken();
    const isMarked = markedKeys.has(groupKey);
    setMarkBusyKey(groupKey);
    try {
      if (isMarked) {
        await fetch(`${API_BASE}/uploads/mark?groupKey=${encodeURIComponent(groupKey)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setMarkedKeys(prev => {
          const next = new Set(prev);
          next.delete(groupKey);
          return next;
        });
      } else {
        await fetch(`${API_BASE}/uploads/mark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ groupKey, displayName }),
        });
        setMarkedKeys(prev => new Set(prev).add(groupKey));
      }
    } catch {
      alert('Mark update fail ho gaya, dobara try karo');
    } finally {
      setMarkBusyKey(null);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(prev => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(allVisibleItems.map(itemId)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const doBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const idToItem = new Map(allVisibleItems.map(i => [itemId(i), i]));
    const targets = Array.from(selectedIds).map(id => idToItem.get(id)).filter((i): i is MediaItem => !!i);

    if (targets.length === 0) {
      setSelectedIds(new Set());
      return;
    }

    setBulkDeleting(true);
    try {
      const payload = { items: targets.map(t => ({ hostname: t.hostname, key: t.key })) };
      const result = await apiCall('/bulk-delete', 'POST', payload);

      const deletedIds = new Set<string>(
        (result.deleted || []).map((d: { hostname: string; key: string }) => `${d.hostname}::${d.key}`)
      );

      setItems(prev => prev.filter(i => !deletedIds.has(itemId(i))));

      setSelectedIds(prev => {
        const next = new Set(prev);
        deletedIds.forEach(id => next.delete(id));
        return next;
      });

      if (result.errors && result.errors.length > 0) {
        const preview = result.errors.slice(0, 5).map((e: any) => `${e.key}: ${e.message}`).join('\n');
        alert(`${deletedIds.size} deleted, ${result.errors.length} fail ho gaye:\n${preview}${result.errors.length > 5 ? '\n...' : ''}`);
      } else {
        setSelectMode(false);
      }
    } catch (err: any) {
      alert(err.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const requestBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      title: 'Delete selected files?',
      message: `${selectedIds.size} file(s) permanently delete karni hain? Yeh undo nahi ho sakta.`,
      confirmLabel: `Delete ${selectedIds.size} file(s)`,
      onConfirm: doBulkDelete,
    });
  };

  const allVisibleSelected = allVisibleItems.length > 0 && allVisibleItems.every(i => selectedIds.has(itemId(i)));

  return (
    <>
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 sm:p-4 space-y-3">
      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-400 rounded-full" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Uploaded Videos
          </h3>
          <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.5 rounded-md">
            {videoOnlyItems.length}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {/* Mark filter segmented */}
          <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
            {([
              { value: 'all', label: 'All' },
              { value: 'marked', label: '★' },
              { value: 'unmarked', label: '☆' },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setMarkFilter(f.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  markFilter === f.value
                    ? f.value === 'marked'
                      ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                      : 'bg-white/[0.08] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleSelectMode}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              selectMode
                ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/25 text-rose-300'
                : 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/25 text-indigo-300'
            }`}
          >
            <SvgIcon d={ICONS.checkbox} className="w-3 h-3" />
            {selectMode ? 'Cancel' : 'Select'}
          </button>

          <button
            onClick={fetchItems}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-all disabled:opacity-40"
          >
            <SvgIcon d={ICONS.refresh} className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ─── Bulk toolbar ─────────────────────────────── */}
      {selectMode && (
        <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-xl">
          <span className="text-xs font-bold text-indigo-200">
            <span className="text-indigo-300">{selectedIds.size}</span> selected
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={allVisibleSelected ? clearSelection : selectAllVisible}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-all"
            >
              {allVisibleSelected ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold transition-all disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={requestBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 text-[10px] font-bold transition-all disabled:opacity-40"
            >
              <SvgIcon d={ICONS.trash} className="w-3 h-3" />
              {bulkDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Bucket + Search ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
        <div className="relative w-full sm:w-56 max-w-full">
          <select
            value={selectedHostname}
            onChange={e => setSelectedHostname(e.target.value)}
            className="w-full appearance-none truncate pl-8 pr-7 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none transition-all focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all" className="bg-slate-900">All Buckets</option>
            {buckets.map(b => <option key={b.hostname} value={b.hostname} className="bg-slate-900">{b.label}</option>)}
          </select>
          <SvgIcon d={ICONS.folder} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <SvgIcon d={ICONS.chevron} className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by filename..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
          />
          <SvgIcon d={ICONS.search} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-rose-500/[0.08] border border-rose-500/20 rounded-lg text-rose-200 text-xs">
          <SvgIcon d={ICONS.warning} className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-[650px] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">

        {/* Images section */}
        {imageItems.length > 0 && (
          <div className="border border-white/[0.06] rounded-xl overflow-hidden">
            <button onClick={() => setImagesExpanded(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
              <span className="flex items-center gap-2">
                <span className="w-1 h-3.5 bg-sky-400 rounded-full" />
                <SvgIcon d={ICONS.image} className="w-3.5 h-3.5 text-sky-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  Images
                </span>
                <span className="text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/25 px-1.5 py-0.5 rounded-md">
                  {imageItems.length}
                </span>
              </span>
              <SvgIcon d={ICONS.chevron} className={`w-3.5 h-3.5 text-gray-500 transition-transform ${imagesExpanded ? 'rotate-180' : ''}`} />
            </button>
            {imagesExpanded && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 p-2.5">
                {imageItems.map(item => {
                  const id = itemId(item);
                  return (
                    <ImageCard
                      key={id}
                      item={item}
                      isRenaming={renamingKey === item.key}
                      renameValue={renameValue}
                      setRenameValue={setRenameValue}
                      busyKey={busyKey}
                      selectMode={selectMode}
                      isSelected={selectedIds.has(id)}
                      onToggleSelect={() => toggleSelectItem(id)}
                      onDownload={() => handleWatchOrDownload(item, 'download')}
                      onCopy={() => handleCopyLink(item)}
                      onRenameStart={() => startRename(item)}
                      onRenameConfirm={() => confirmRename(item)}
                      onRenameCancel={() => setRenamingKey(null)}
                      onDelete={() => requestDelete(item)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <span className="w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-medium">Loading...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          imageItems.length === 0 && (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <SvgIcon d={ICONS.video} className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {markFilter === 'marked' ? 'No marked videos'
                  : markFilter === 'unmarked' ? 'All videos are marked'
                  : 'No videos found'}
              </p>
            </div>
          )
        ) : (
          filteredGroups.map(group => renderGroupCard(group))
        )}
      </div>
    </div>

    {/* ─── Confirm Modal ──────────────────────────────── */}
    {confirmModal && (
      <div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={() => setConfirmModal(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/40"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <SvgIcon d={ICONS.warning} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="text-sm font-semibold text-white">{confirmModal.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">{confirmModal.message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              onClick={() => setConfirmModal(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const action = confirmModal.onConfirm;
                setConfirmModal(null);
                action();
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40"
            >
              {confirmModal.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );

  function renderGroupCard(group: typeof groupedSeries[number]) {
    const isExpanded = expandedGroups.has(group.groupKey);
    const isMarked = markedKeys.has(group.groupKey);
    return (
      <div key={group.groupKey} className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="w-full flex items-center bg-white/[0.03] border-b border-white/[0.06]">
          <button onClick={() => toggleGroup(group.groupKey)}
            className="flex-1 min-w-0 hover:bg-white/[0.04] px-3 py-2.5 flex items-center justify-between transition-colors text-left">
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-purple-300 truncate">{group.displayName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {group.epRange && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                    {group.epRange}
                  </span>
                )}
                <span className="text-[10px] text-gray-500">
                  {group.episodes.length} episode{group.episodes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <SvgIcon d={ICONS.chevron} className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>

          {!selectMode && (
            <button
              onClick={() => setBulkAddGroupKey(bulkAddGroupKey === group.groupKey ? null : group.groupKey)}
              title="Add all episodes to a Download Page"
              className={`px-2.5 py-2.5 flex-shrink-0 text-[10px] font-bold transition-all whitespace-nowrap ${
                bulkAddGroupKey === group.groupKey
                  ? 'text-rose-400'
                  : 'text-indigo-300 hover:text-indigo-200'
              }`}
            >
              {bulkAddGroupKey === group.groupKey ? 'Close' : '+ All to Page'}
            </button>
          )}

          {!selectMode && (
            <button
              onClick={() => toggleMark(group.groupKey, group.displayName)}
              disabled={markBusyKey === group.groupKey}
              title={isMarked ? 'Unmark' : 'Mark'}
              className={`px-2.5 py-2.5 flex-shrink-0 transition-all ${
                isMarked
                  ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
                  : 'text-white/25 hover:text-white/60'
              }`}
            >
              {markBusyKey === group.groupKey
                ? <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin inline-block" />
                : <SvgIcon d={ICONS.star} className={`w-3.5 h-3.5 ${isMarked ? 'fill-current' : ''}`} />}
            </button>
          )}

          {selectMode && (
            <button
              onClick={() => {
                setSelectedIds(prev => {
                  const next = new Set(prev);
                  const ids = group.episodes.map(e => itemId(e.item));
                  const allSelected = ids.every(id => next.has(id));
                  ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
                  return next;
                });
              }}
              className="px-2.5 py-2.5 flex-shrink-0 text-[10px] font-bold text-indigo-300 hover:text-indigo-200 whitespace-nowrap"
            >
              {group.episodes.every(e => selectedIds.has(itemId(e.item))) ? 'Deselect' : 'Select'}
            </button>
          )}
        </div>

        {bulkAddGroupKey === group.groupKey && (
          <AddToPageModal
            items={group.episodes.map(e => ({ url: e.item.url, episode: e.episode }))}
            token={tokenProp}
            onClose={() => setBulkAddGroupKey(null)}
          />
        )}

        {isExpanded && (
          <div className="divide-y divide-white/[0.04]">
            {group.episodes.map(({ item, episode }) => {
              const rowId = `${item.hostname}-${item.key}`;
              const isPlaying = playingItem?.id === rowId;
              const isAddingToPage = addToPageRowId === rowId;
              const id = itemId(item);

              return (
                <React.Fragment key={rowId}>
                  <EpisodeRow
                    item={item}
                    episode={episode}
                    isRenaming={renamingKey === item.key}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    busyKey={busyKey}
                    isPlaying={isPlaying}
                    isAddingToPage={isAddingToPage}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(id)}
                    onToggleSelect={() => toggleSelectItem(id)}
                    onWatch={() => handleWatchOrDownload(item, 'watch')}
                    onDownload={() => handleWatchOrDownload(item, 'download')}
                    onCopy={() => handleCopyLink(item)}
                    onToggleAddToPage={() => setAddToPageRowId(isAddingToPage ? null : rowId)}
                    onRenameStart={() => startRename(item)}
                    onRenameConfirm={() => confirmRename(item)}
                    onRenameCancel={() => setRenamingKey(null)}
                    onDelete={() => requestDelete(item)}
                  />
                  {isPlaying && playingItem && (
                    <div className="py-3 bg-black/40 px-3">
                      <div className="rounded-lg overflow-hidden aspect-video bg-black">
                        <VideoPlayer key={playingItem.url} src={playingItem.url} title={item.key} />
                      </div>
                    </div>
                  )}

                  {isAddingToPage && (
                    <AddToPageModal
                      items={[{ url: item.url, episode }]}
                      token={tokenProp}
                      onClose={() => setAddToPageRowId(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  }
};

export default MediaLibrary;