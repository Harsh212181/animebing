 // ============================================================
// src/components/admin/TrackListManager.tsx
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

/* ---------- Inline SVG Icons ---------- */
const Icon = {
  plus: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  check: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  trash: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  edit: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  refresh: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  eye: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  share: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  ),
  play: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  ),
  youtube: (cls = 'w-6 h-6') => (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
    </svg>
  ),
  spinner: (cls = 'w-5 h-5') => (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
  bell: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  history: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chevron: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronRight: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  search: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5A6.5 6.5 0 114 10.5a6.5 6.5 0 0113 0z" />
    </svg>
  ),
  warn: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  checkAll: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l3 3 8-9M9 17l3 3 8-9" />
    </svg>
  ),
  undo: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L4 10m0 0l5-5m-5 5h11a4 4 0 010 8h-1" />
    </svg>
  ),
  conflict: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  file: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  info: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  link: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m4.656.344a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
    </svg>
  ),
  ban: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 105.636 5.636a9 9 0 0012.728 12.728zM5.636 5.636l12.728 12.728" />
    </svg>
  ),
  clapperboard: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 8l1.5-4h13L20 8M4 8v11a1 1 0 001 1h14a1 1 0 001-1V8M8 4l1 4m5-4l1 4" />
    </svg>
  ),
  back: (cls = 'w-4 h-4') => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
};

/* ---------- Types ---------- */
interface TrackedTitle {
  id: string;
  keyword: string;
  lastKnownPart: number;
}
interface TrackedChannel {
  _id: string;
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelThumbnail?: string;
  paused?: boolean;
  titles: TrackedTitle[];
  consecutiveErrors?: number;
}
interface Capacity { channelsUsed: number; channelsLimit: number; unitsUsedPerCheck: number; unitsLimit: number }
interface TrackNotification {
  _id: string; message: string; channelId: string; channelName: string; titleKeyword: string;
  newVideoId: string; newVideoTitle: string; newVideoUrl: string; newThumbnail?: string; newPart: number;
  oldVideoId?: string; oldVideoTitle?: string; oldThumbnail?: string; oldPart?: number;
  isRead: boolean; createdAt: string;
  notifType?: 'new_episode' | 'season_change' | 'limit_reached' | 'manual_review' | 'needs_approval' | 'auto_paused';
  autoAdded?: boolean; linkedDownloadPageId?: string; linkedDownloadPageSlug?: string;
  undone?: boolean;
}
interface RunLog { _id: string; runAt: string; channelsChecked: number; updatesFound: number; errorCount: number; errorChannels?: string[] }
interface AnimeOption { _id: string; title: string; thumbnail?: string }
interface PageOption { _id: string; slug: string; title?: string; links?: any[] }
interface ConflictEntry {
  pageId: string;
  slug: string;
  titles: { channelId: string; channelName: string; titleId: string; keyword: string }[];
}
interface PreviewVideo {
  videoId: string; videoTitle: string; description?: string; thumbnail: string; publishedAt: string;
  part: number | null; isRange: boolean; rangeStart?: number; matchedFormat?: string;
  durationSec?: number | null;
}

/* ---------- Duration formatter ---------- */
const formatDuration = (sec?: number | null) => {
  if (sec == null) return null;
  if (sec === 0) return 'Live/Unknown';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ---------- Page label helper ---------- */
const pageLabel = (index: number) => `Page ${index + 1}`;

/* ---------- Searchable Dropdown Component ---------- */
const SearchableDropdown: React.FC<{
  options: AnimeOption[];
  value: AnimeOption | null;
  onChange: (option: AnimeOption | null) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder = 'Search...' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(opt =>
    opt.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer text-white text-sm"
        onClick={() => setOpen(o => !o)}
      >
        {value?.thumbnail && (
          <img src={value.thumbnail} className="w-6 h-6 object-cover rounded" alt="" />
        )}
        <span className="flex-1 truncate">{value?.title || placeholder}</span>
        <span className="text-slate-400">{Icon.chevron('w-3.5 h-3.5')}</span>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl max-h-52 overflow-y-auto shadow-xl">
          <input
            type="text"
            autoFocus
            placeholder="Search anime..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-gray-800/60 border-b border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">No anime found</div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt._id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-purple-500/20 cursor-pointer text-sm text-white"
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                {opt.thumbnail ? (
                  <img src={opt.thumbnail} className="w-8 h-8 object-cover rounded" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">N/A</div>
                )}
                <span className="truncate">{opt.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- Page Dropdown Component ---------- */
const PageDropdown: React.FC<{
  pages: { _id: string; slug?: string; links?: any[] }[];
  value: string;
  onChange: (pageId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showLinkCount?: boolean;
  className?: string;
}> = ({ pages, value, onChange, disabled = false, placeholder = '-- Page select karo --', showLinkCount = false, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedIndex = pages.findIndex(p => p._id === value);
  const watchCount = (p: { links?: any[] }) => (p.links || []).filter((l: any) => l.type === 'watch').length;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs border transition ${
          disabled
            ? 'bg-gray-800/30 border-gray-800 text-slate-600 cursor-not-allowed'
            : 'bg-gray-800/60 border-gray-700 text-white cursor-pointer hover:border-purple-500/40'
        }`}
      >
        <span className={`flex-shrink-0 ${disabled ? 'text-slate-600' : 'text-sky-400'}`}>{Icon.file('w-3.5 h-3.5')}</span>
        <span className="flex-1 truncate">
          {selectedIndex >= 0 ? pageLabel(selectedIndex) : placeholder}
        </span>
        {selectedIndex >= 0 && showLinkCount && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
            {watchCount(pages[selectedIndex])} links
          </span>
        )}
        <span className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${disabled ? 'text-slate-700' : 'text-slate-400'}`}>
          {Icon.chevron('w-3 h-3')}
        </span>
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl max-h-52 overflow-y-auto shadow-xl">
          {pages.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">Koi page nahi mila</div>
          ) : (
            pages.map((p, idx) => (
              <div
                key={p._id}
                onClick={() => { onChange(p._id); setOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition ${
                  p._id === value ? 'bg-purple-500/20 text-white' : 'text-slate-300 hover:bg-purple-500/10'
                }`}
              >
                <span className="text-sky-400 flex-shrink-0">{Icon.file('w-3.5 h-3.5')}</span>
                <span className="flex-1 truncate">{pageLabel(idx)}</span>
                {showLinkCount && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 flex-shrink-0">
                    {watchCount(p)} links
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- Helper ---------- */
const formatIST = (isoDate: string) =>
  new Date(isoDate).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' IST';

/* ---------- Main Component ---------- */
const TrackListManager: React.FC = () => {
  // ============ STATE ============
  const [channels, setChannels] = useState<TrackedChannel[]>([]);
  const [capacity, setCapacity] = useState<Capacity>({
    channelsUsed: 0,
    channelsLimit: 5000,
    unitsUsedPerCheck: 0,
    unitsLimit: 10000,
  });
  const [notifications, setNotifications] = useState<TrackNotification[]>([]);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [newHandle, setNewHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [titleInputs, setTitleInputs] = useState<Record<string, string>>({});
  const [excludeKeywordsInputs, setExcludeKeywordsInputs] = useState<Record<string, string>>({});
  const [checkingNow, setCheckingNow] = useState<Record<string, boolean>>({});
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editLastPart, setEditLastPart] = useState('');
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkModeChannel, setBulkModeChannel] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [showAllUpdatesGlobal, setShowAllUpdatesGlobal] = useState(false);

  // Unified top row states
  const [showConflicts, setShowConflicts] = useState(false);
  const [showGlobalFeed, setShowGlobalFeed] = useState(false);
  const [showAllTitles, setShowAllTitles] = useState(false);

  // Automation link states
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [pagesForAnime, setPagesForAnime] = useState<PageOption[]>([]);
  const [linkFormTitleId, setLinkFormTitleId] = useState<string | null>(null);
  const [linkAnimeId, setLinkAnimeId] = useState('');
  const [linkPageId, setLinkPageId] = useState('');
  const [linkLimit, setLinkLimit] = useState('0');
  const [linkMergeMode, setLinkMergeMode] = useState(true);
  const [linkBaselineMin, setLinkBaselineMin] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // All Titles browse
  const [allTitlesSearch, setAllTitlesSearch] = useState('');
  const [browsingTitle, setBrowsingTitle] = useState<{ channelId: string; titleId: string; keyword: string } | null>(null);
  const [browseData, setBrowseData] = useState<any>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [bulkPageId, setBulkPageId] = useState('');
  const [bulkAnimeId, setBulkAnimeId] = useState('');
  const [bulkPages, setBulkPages] = useState<any[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [episodeOverrides, setEpisodeOverrides] = useState<Record<string, string>>({});
  const [bulkIgnoring, setBulkIgnoring] = useState(false);

  // Test Match Preview
  const [previewForChannel, setPreviewForChannel] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<{ matchedCount: number; videos: PreviewVideo[] } | null>(null);
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());
  const [previewBulkAnimeId, setPreviewBulkAnimeId] = useState('');
  const [previewBulkPageId, setPreviewBulkPageId] = useState('');
  const [previewBulkPages, setPreviewBulkPages] = useState<any[]>([]);
  const [previewEpisodeOverrides, setPreviewEpisodeOverrides] = useState<Record<string, string>>({});
  const [previewAdding, setPreviewAdding] = useState(false);

  // Scan depth and inline expand
  const [previewScanDepth, setPreviewScanDepth] = useState(50);
  const [browseScanDepth, setBrowseScanDepth] = useState(150);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  // Conflicts
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);

  // Undo
  const [undoing, setUndoing] = useState<Record<string, boolean>>({});

  // Clear states
  const [clearingLogs, setClearingLogs] = useState(false);
  const [clearingRuns, setClearingRuns] = useState(false);

  // ✅ Channel delete confirmation modal state
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{ channelId: string; channelName: string } | null>(null);
  const [deletingChannel, setDeletingChannel] = useState(false);

  // ✅ NEW — Notification delete confirmation modal state
  const [notificationDeleteConfirm, setNotificationDeleteConfirm] = useState<{ 
    notificationId: string; 
    count?: number; 
    isBulk?: boolean;
    title?: string;
  } | null>(null);
  const [deletingNotification, setDeletingNotification] = useState(false);

  // Channel Feed visibility
  const [showChannelFeed, setShowChannelFeed] = useState<Record<string, boolean>>({});

  const token = localStorage.getItem('adminToken');
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  // ============ DATA LOADING ============
  const loadData = async () => {
    try {
      const [channelsRes, capacityRes, notifsRes, runsRes, logsRes, conflictsRes] = await Promise.all([
        axios.get(`${API_BASE}/track/channels`, authHeaders()),
        axios.get(`${API_BASE}/track/capacity`, authHeaders()),
        axios.get(`${API_BASE}/track/notifications`, authHeaders()),
        axios.get(`${API_BASE}/track/runs`, authHeaders()),
        axios.get(`${API_BASE}/track/logs`, authHeaders()),
        axios.get(`${API_BASE}/track/conflicts`, authHeaders()).catch(() => ({ data: [] })),
      ]);
      setChannels(channelsRes.data || []);
      setCapacity(capacityRes.data);
      setNotifications(notifsRes.data || []);
      setRuns(runsRes.data || []);
      setLogs(logsRes.data || []);
      setConflicts(conflictsRes.data || []);
    } catch {
      toast.error('Data load nahi ho saka');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimeOptions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/protected/anime-list`, authHeaders());
      const arr = res.data.data || res.data;
      if (Array.isArray(arr)) {
        const normalizeThumb = (a: any) => {
          let thumb = a.thumbnail;
          if (thumb && !thumb.startsWith('http')) thumb = `${API_BASE}${thumb.startsWith('/') ? '' : '/'}${thumb}`;
          return thumb;
        };
        setAnimeOptions(arr.map((a: any) => ({
          _id: a._id,
          title: a.title,
          thumbnail: normalizeThumb(a) || undefined,
        })));
      }
    } catch {
      // silent
    }
  };

  const fetchPagesForAnime = async (animeId: string) => {
    if (!animeId) { setPagesForAnime([]); return; }
    try {
      const res = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`, authHeaders());
      if (Array.isArray(res.data)) setPagesForAnime(res.data);
    } catch {
      setPagesForAnime([]);
    }
  };

  useEffect(() => {
    loadData();
    fetchAnimeOptions();
  }, []);

  // ============ CHANNEL ACTIONS ============
  const runAllNow = async () => {
    setRunningAll(true);
    try {
      const { data } = await axios.post(`${API_BASE}/track/run-all-now`, {}, authHeaders());
      toast.success(
        `Test run complete! ${data.channelsChecked} channels check hue, ${data.updatesFound} updates mile${
          data.errorCount > 0 ? `, ${data.errorCount} error` : ''
        }`
      );
      setShowRunHistory(true);
      loadData();
    } catch {
      toast.error('Test run fail ho gaya');
    } finally {
      setRunningAll(false);
    }
  };

  const clearAllLogs = async () => {
    // ✅ Custom modal for clear all logs
    setNotificationDeleteConfirm({ 
      notificationId: 'all-logs', 
      count: logs.length,
      isBulk: true,
      title: 'All Check Logs'
    });
  };

  const confirmClearLogs = async () => {
    setDeletingNotification(true);
    try {
      const { data } = await axios.delete(`${API_BASE}/track/logs/clear-all`, authHeaders());
      toast.success(`${data.count} logs clear ho gaye`);
      loadData();
    } catch {
      toast.error('Clear nahi ho saka');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
    }
  };

  const clearAllRuns = async () => {
    // ✅ Custom modal for clear all runs
    setNotificationDeleteConfirm({ 
      notificationId: 'all-runs', 
      count: runs.length,
      isBulk: true,
      title: 'All Run History'
    });
  };

  const confirmClearRuns = async () => {
    setDeletingNotification(true);
    try {
      const { data } = await axios.delete(`${API_BASE}/track/runs/clear-all`, authHeaders());
      toast.success(`${data.count} runs clear ho gaye`);
      loadData();
    } catch {
      toast.error('Clear nahi ho saka');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
    }
  };

  const addChannel = async () => {
    if (!newHandle.trim()) return;
    setAdding(true);
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/add`, { handle: newHandle.trim() }, authHeaders());
      if (data.success) {
        toast.success(`"${data.channelName}" add ho gaya`);
        setNewHandle('');
        loadData();
      } else {
        toast.error(data.error || 'Add nahi ho saka');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Add nahi ho saka');
    } finally {
      setAdding(false);
    }
  };

  // ✅ CHANGED — ab sirf modal khol deta hai, actual delete confirmDeleteChannel karta hai
  const removeChannel = (channelId: string, channelName: string) => {
    setChannelDeleteConfirm({ channelId, channelName });
  };

  const confirmDeleteChannel = async () => {
    if (!channelDeleteConfirm) return;
    setDeletingChannel(true);
    try {
      await axios.delete(`${API_BASE}/track/channel/${channelDeleteConfirm.channelId}`, authHeaders());
      toast.success('Channel remove ho gaya');
      if (selectedChannelId === channelDeleteConfirm.channelId) setSelectedChannelId(null);
      loadData();
    } catch {
      toast.error('Remove nahi ho saka');
    } finally {
      setDeletingChannel(false);
      setChannelDeleteConfirm(null);
    }
  };

  const refreshChannelInfo = async (channelId: string) => {
    try {
      await axios.post(`${API_BASE}/track/channel/${channelId}/refresh-info`, {}, authHeaders());
      toast.success('Logo/naam update ho gaya');
      loadData();
    } catch {
      toast.error('Refresh nahi ho saka');
    }
  };

  const checkNow = async (channelId: string) => {
    setCheckingNow((prev) => ({ ...prev, [channelId]: true }));
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/check-now`, {}, authHeaders());
      toast.success(data.updatesFound > 0 ? `${data.updatesFound} naya update mila!` : 'Koi naya update nahi mila');
      loadData();
    } catch {
      toast.error('Check fail ho gaya (agar ye baar baar ho raha hai, channel auto-pause ho sakta hai)');
      loadData();
    } finally {
      setCheckingNow((prev) => ({ ...prev, [channelId]: false }));
    }
  };

  const togglePause = async (channelId: string) => {
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/toggle-pause`, {}, authHeaders());
      toast.success(data.paused ? 'Channel pause ho gaya' : 'Channel resume ho gaya (error counter reset)');
      loadData();
    } catch {
      toast.error('Pause/Resume fail ho gaya');
    }
  };

  // ============ PREVIEW ============
  const openPreview = (channelId: string) => {
    if (previewForChannel === channelId) {
      setPreviewForChannel(null);
      setPreviewResults(null);
      return;
    }
    setPreviewForChannel(channelId);
    setPreviewResults(null);
  };

  const runPreview = async (channelId: string, depth?: number) => {
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword) {
      toast.error('Pehle keyword likho, fir Preview dabao');
      return;
    }
    const excludeKeywords = (excludeKeywordsInputs[channelId] || '').split(',').map(s => s.trim()).filter(Boolean);
    const useDepth = depth ?? previewScanDepth;
    setPreviewLoading(true);
    setPreviewResults(null);
    setPreviewSelectedIds(new Set());
    setPreviewEpisodeOverrides({});
    try {
      const { data } = await axios.post(
        `${API_BASE}/track/channel/${channelId}/title/test-match`,
        { keyword, scanDepth: useDepth, excludeKeywords },
        authHeaders()
      );
      setPreviewResults({ matchedCount: data.matchedCount, videos: data.videos });
      if (data.matchedCount === 0) {
        toast('Is keyword se koi video match nahi hua — keyword badal ke dekho');
      }
    } catch {
      toast.error('Preview load nahi ho saka');
    } finally {
      setPreviewLoading(false);
    }
  };

  const scanPreviewDeeper = (channelId: string) => {
    const next = previewScanDepth + 1500;
    setPreviewScanDepth(next);
    runPreview(channelId, next);
  };

  const fetchPreviewBulkPages = async (animeId: string) => {
    setPreviewBulkAnimeId(animeId);
    setPreviewBulkPageId('');
    if (!animeId) { setPreviewBulkPages([]); return; }
    try {
      const res = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`, authHeaders());
      if (Array.isArray(res.data)) setPreviewBulkPages(res.data);
    } catch {
      setPreviewBulkPages([]);
    }
  };

  const togglePreviewVideoSelect = (videoId: string) => {
    setPreviewSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const selectAllPreviewVideos = () => {
    if (!previewResults?.videos) return;
    const allIds = previewResults.videos.map(v => v.videoId);
    const allSelected = allIds.every(id => previewSelectedIds.has(id));
    setPreviewSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const doPreviewBulkAdd = async (channelId: string) => {
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword || !previewBulkPageId || previewSelectedIds.size === 0) return;
    setPreviewAdding(true);
    try {
      const overridesToSend: Record<string, number> = {};
      for (const vid of previewSelectedIds) {
        const raw = previewEpisodeOverrides[vid];
        if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
          overridesToSend[vid] = Number(raw);
        }
      }
      const { data } = await axios.post(
        `${API_BASE}/track/channel/${channelId}/quick-bulk-add`,
        { keyword, downloadPageId: previewBulkPageId, videoIds: Array.from(previewSelectedIds), episodeOverrides: overridesToSend },
        authHeaders()
      );
      toast.success(`${data.added} episodes seedha add ho gaye!`);
      setPreviewSelectedIds(new Set());
      setPreviewEpisodeOverrides({});
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Add nahi ho saka');
    } finally {
      setPreviewAdding(false);
    }
  };

  // ============ TITLE ACTIONS ============
  const addTitle = async (channelId: string) => {
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword) return;
    const excludeKeywords = (excludeKeywordsInputs[channelId] || '').split(',').map(s => s.trim()).filter(Boolean);
    try {
      await axios.post(`${API_BASE}/track/channel/${channelId}/title/add`, { keyword, currentKnownPart: 0, excludeKeywords }, authHeaders());
      toast.success(`"${keyword}" add ho gaya`);
      setTitleInputs({ ...titleInputs, [channelId]: '' });
      setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [channelId]: '' });
      setPreviewResults(null);
      setPreviewForChannel(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Title add nahi ho saka');
    }
  };

  const addBulkTitles = async (channelId: string) => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    try {
      const { data } = await axios.post(
        `${API_BASE}/track/channel/${channelId}/title/bulk-add`,
        { keywords: lines },
        authHeaders()
      );
      toast.success(`${data.added} titles add ho gaye${data.skipped?.length ? `, ${data.skipped.length} pehle se the` : ''}`);
      setBulkText('');
      setBulkModeChannel(null);
      loadData();
    } catch {
      toast.error('Bulk add me kuch fail ho gaya');
    }
  };

  const startEditTitle = (title: TrackedTitle) => {
    setEditingTitle(title.id);
    setEditKeyword(title.keyword);
    setEditLastPart(String(title.lastKnownPart));
  };

  const cancelEditTitle = () => {
    setEditingTitle(null);
    setEditKeyword('');
    setEditLastPart('');
  };

  const saveEditTitle = async (channelId: string, titleId: string) => {
    try {
      await axios.put(
        `${API_BASE}/track/channel/${channelId}/title/${titleId}/edit`,
        { keyword: editKeyword.trim(), lastKnownPart: Number(editLastPart) || 0 },
        authHeaders()
      );
      toast.success('Title update ho gaya');
      cancelEditTitle();
      loadData();
    } catch {
      toast.error('Update nahi ho saka');
    }
  };

  const removeTitle = async (channelId: string, titleId: string) => {
    try {
      await axios.delete(`${API_BASE}/track/channel/${channelId}/title/${titleId}`, authHeaders());
      toast.success('Title remove ho gaya');
      loadData();
    } catch {
      toast.error('Remove nahi ho saka');
    }
  };

  // ============ LINK FORM ============
  const openLinkForm = (t: TrackedTitle) => {
    if (linkFormTitleId === t.id) {
      closeLinkForm();
      return;
    }
    setLinkFormTitleId(t.id);
    const anyT = t as any;
    setLinkAnimeId(anyT.linkedAnimeId || '');
    setLinkPageId(anyT.linkedDownloadPageId || '');
    setLinkLimit(String(anyT.episodeLimit || 0));
    setLinkMergeMode(anyT.mergeMode !== false);
    setLinkBaselineMin(anyT.baselineEpisodeDurationSec ? String(Math.round(anyT.baselineEpisodeDurationSec / 60)) : '');
    if (anyT.linkedAnimeId) fetchPagesForAnime(anyT.linkedAnimeId);
  };

  const closeLinkForm = () => {
    setLinkFormTitleId(null);
    setLinkAnimeId('');
    setLinkPageId('');
    setLinkLimit('0');
    setLinkBaselineMin('');
    setPagesForAnime([]);
    setLinkMergeMode(true);
  };

  const saveLinkForm = async (channelId: string) => {
    if (!linkFormTitleId) return;
    setSavingLink(true);
    try {
      const { data } = await axios.put(
        `${API_BASE}/track/channel/${channelId}/title/${linkFormTitleId}/link`,
        {
          linkedAnimeId: linkAnimeId || null,
          linkedDownloadPageId: linkPageId || null,
          episodeLimit: Number(linkLimit) || 0,
          mergeMode: linkMergeMode,
          baselineEpisodeMinutes: linkBaselineMin ? Number(linkBaselineMin) : undefined,
        },
        authHeaders()
      );
      if (data.warning) {
        toast(data.warning, { duration: 6000 });
      } else {
        toast.success('Page link ho gaya!');
      }
      closeLinkForm();
      loadData();
    } catch {
      toast.error('Link save nahi ho saka');
    } finally {
      setSavingLink(false);
    }
  };

  const unlinkTitle = async (channelId: string, titleId: string) => {
    try {
      await axios.put(
        `${API_BASE}/track/channel/${channelId}/title/${titleId}/link`,
        { linkedAnimeId: null, linkedDownloadPageId: null, episodeLimit: 0, resetSeason: true },
        authHeaders()
      );
      toast.success('Unlink ho gaya');
      loadData();
    } catch {
      toast.error('Unlink fail ho gaya');
    }
  };

  // ============ ALL TITLES BROWSE ============
  const allTitlesFlat = channels.flatMap(ch =>
    (ch.titles || []).map((t: any) => ({
      ...t,
      channelId: ch._id,
      channelName: ch.channelName,
      channelThumbnail: ch.channelThumbnail,
    }))
  );

  const filteredAllTitles = allTitlesFlat.filter((t: any) => {
    const q = allTitlesSearch.trim().toLowerCase();
    if (!q) return true;
    return t.keyword.toLowerCase().includes(q) || t.channelName?.toLowerCase().includes(q);
  });

  const openBrowseTitle = async (channelId: string, titleId: string, keyword: string, depth?: number) => {
    const useDepth = depth ?? 150;
    if (browsingTitle?.titleId === titleId && browsingTitle?.channelId === channelId && !depth) {
      setBrowsingTitle(null);
      setBrowseData(null);
      return;
    }
    setBrowsingTitle({ channelId, titleId, keyword });
    setBrowseScanDepth(useDepth);
    setBrowseLoading(true);
    if (!depth) {
      setSelectedVideoIds(new Set());
      setEpisodeOverrides({});
      setBulkPageId('');
      setBulkAnimeId('');
    }
    try {
      const res = await axios.get(`${API_BASE}/track/channel/${channelId}/title/${titleId}/all-videos?depth=${useDepth}`, authHeaders());
      setBrowseData(res.data);
    } catch {
      toast.error('Videos load nahi ho sake');
    } finally {
      setBrowseLoading(false);
    }
  };

  const closeBrowseTitle = () => {
    setBrowsingTitle(null);
    setBrowseData(null);
    setSelectedVideoIds(new Set());
    setEpisodeOverrides({});
    setExpandedInfoId(null);
  };

  const toggleVideoSelect = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const selectAllVideos = () => {
    if (!browseData?.videos) return;
    const allIds = browseData.videos.map((v: any) => v.videoId);
    const allSelected = allIds.every((id: string) => selectedVideoIds.has(id));
    setSelectedVideoIds(allSelected ? new Set() : new Set(allIds));
  };

  const fetchBulkPages = async (animeId: string) => {
    setBulkAnimeId(animeId);
    setBulkPageId('');
    if (!animeId) { setBulkPages([]); return; }
    try {
      const res = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`, authHeaders());
      if (Array.isArray(res.data)) setBulkPages(res.data);
    } catch {
      setBulkPages([]);
    }
  };

  const doBulkAdd = async () => {
    if (!browsingTitle || !bulkPageId || selectedVideoIds.size === 0) return;
    try {
      const overridesToSend: Record<string, number> = {};
      for (const vid of selectedVideoIds) {
        const raw = episodeOverrides[vid];
        if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
          overridesToSend[vid] = Number(raw);
        }
      }
      const { data } = await axios.post(
        `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/bulk-add`,
        { downloadPageId: bulkPageId, videoIds: Array.from(selectedVideoIds), episodeOverrides: overridesToSend },
        authHeaders()
      );
      toast.success(`${data.added} episodes add ho gaye!`);
      setSelectedVideoIds(new Set());
      setEpisodeOverrides({});
      openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Add nahi ho saka');
    }
  };

  const ignoreVideo = async (videoId: string) => {
    if (!browsingTitle) return;
    try {
      await axios.post(`${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/ignore-video`, { videoId }, authHeaders());
      toast.success('Video ignore ho gaya, ab kabhi nahi dikhega');
      openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
    } catch {
      toast.error('Ignore fail ho gaya');
    }
  };

  const bulkIgnoreSelected = async () => {
    if (!browsingTitle || selectedVideoIds.size === 0) return;
    setBulkIgnoring(true);
    try {
      const ids = Array.from(selectedVideoIds);
      await axios.post(
        `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/ignore-videos-bulk`,
        { videoIds: ids },
        authHeaders()
      );
      toast.success(`${ids.length} video(s) ignore ho gaye`);
      setSelectedVideoIds(new Set());
      setEpisodeOverrides({});
      openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
    } catch {
      toast.error('Bulk ignore me kuch fail ho gaya');
    } finally {
      setBulkIgnoring(false);
    }
  };

  const finalizeApproval = async () => {
    if (!browsingTitle) return;
    setFinalizing(true);
    try {
      await axios.post(`${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/finalize-initial`, {}, authHeaders());
      toast.success('Approve ho gaya! Ab naye episodes automatically add honge.');
      closeBrowseTitle();
      loadData();
    } catch {
      toast.error('Finalize fail ho gaya');
    } finally {
      setFinalizing(false);
    }
  };

  const scanBrowseDeeper = () => {
    if (!browsingTitle) return;
    const next = browseScanDepth + 150;
    openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword, next);
  };

  // ============ NOTIFICATION ACTIONS ============
  const markDone = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/track/notifications/${id}/read`, {}, authHeaders());
      loadData();
    } catch {
      toast.error('Mark nahi ho saka');
    }
  };

  // ✅ CHANGED — ab modal kholta hai for single notification delete
  const deleteNotification = (id: string) => {
    const notif = notifications.find(n => n._id === id);
    if (notif) {
      setNotificationDeleteConfirm({
        notificationId: id,
        title: notif.titleKeyword || notif.channelName,
        isBulk: false,
      });
    }
  };

  const confirmDeleteNotification = async () => {
    if (!notificationDeleteConfirm) return;
    setDeletingNotification(true);
    try {
      await axios.delete(`${API_BASE}/track/notifications/${notificationDeleteConfirm.notificationId}`, authHeaders());
      toast.success('Remove ho gaya');
      loadData();
    } catch {
      toast.error('Remove nahi ho saka');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
    }
  };

  const markAllDoneInList = async (list: TrackNotification[]) => {
    const unread = list.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => axios.post(`${API_BASE}/track/notifications/${n._id}/read`, {}, authHeaders())));
      toast.success(`${unread.length} updates "Done" mark ho gaye`);
      loadData();
    } catch {
      toast.error('Mark all fail ho gaya');
    }
  };

  // ✅ CHANGED — ab modal kholta hai for bulk delete
  const deleteAllInList = (list: TrackNotification[]) => {
    if (list.length === 0) return;
    setNotificationDeleteConfirm({
      notificationId: 'bulk-notifications',
      count: list.length,
      isBulk: true,
      title: 'All Notifications in this list',
    });
  };

  const confirmBulkDeleteNotifications = async () => {
    if (!notificationDeleteConfirm || notificationDeleteConfirm.notificationId !== 'bulk-notifications') return;
    setDeletingNotification(true);
    try {
      // Get the list based on context - this is called from within the component's context
      // We'll handle this differently - the list is passed from the caller
      // Let's use a different approach: we'll store the list in a ref or state
      // For simplicity, we'll use the current pending list
      const currentList = showGlobalFeed ? 
        (showAllUpdatesGlobal ? notifications : notifications.filter((n) => !n.isRead)) :
        (selectedChannel ? 
          (showAllUpdates ? 
            notifications.filter((n) => n.channelId === selectedChannel?.channelId) : 
            notifications.filter((n) => n.channelId === selectedChannel?.channelId && !n.isRead)) : 
          []
        );
      
      await Promise.all(currentList.map((n) => axios.delete(`${API_BASE}/track/notifications/${n._id}`, authHeaders())));
      toast.success(`${currentList.length} updates remove ho gaye`);
      loadData();
    } catch {
      toast.error('Clear all fail ho gaya');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
    }
  };

  const shareVideo = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copy ho gaya!');
    } catch {
      toast.error('Copy nahi ho saka');
    }
  };

  const resolveSeasonChange = async (notif: TrackNotification) => {
    const slug = prompt('Naye season ke page ka slug likho (jaise: series-name-season-2):');
    if (!slug) return;
    const channel = channels.find(ch => (ch.titles || []).some((t: any) => t.keyword === notif.titleKeyword));
    const title = channel?.titles.find((t: any) => t.keyword === notif.titleKeyword) as any;
    if (!title || !channel) { toast.error('Title/channel nahi mila'); return; }
    try {
      await axios.post(`${API_BASE}/track/channel/${channel._id}/title/${title.id}/resolve-season`, { newSlug: slug }, authHeaders());
      toast.success('Naya page ban gaya, season change resolve ho gaya!');
      markDone(notif._id);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Fail ho gaya');
    }
  };

  // ============ UNDO ============
  const undoNotification = async (n: TrackNotification) => {
    // ✅ Custom modal for undo
    setNotificationDeleteConfirm({
      notificationId: `undo-${n._id}`,
      title: n.titleKeyword || n.channelName,
      isBulk: false,
    });
  };

  const confirmUndoNotification = async () => {
    if (!notificationDeleteConfirm || !notificationDeleteConfirm.notificationId.startsWith('undo-')) return;
    const notifId = notificationDeleteConfirm.notificationId.replace('undo-', '');
    const n = notifications.find(n => n._id === notifId);
    if (!n) { setNotificationDeleteConfirm(null); return; }
    
    setDeletingNotification(true);
    try {
      await axios.post(`${API_BASE}/track/notifications/${n._id}/undo`, {}, authHeaders());
      toast.success('Undo ho gaya — link page se hata diya gaya');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Undo fail ho gaya');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
    }
  };

  // ============ DERIVED DATA ============
  const selectedChannel = channels.find((ch) => ch._id === selectedChannelId);
  const channelNotifications = notifications.filter((n) => n.channelId === selectedChannel?.channelId);
  const pendingChannelNotifs = showAllUpdates ? channelNotifications : channelNotifications.filter((n) => !n.isRead);

  const pendingGlobalNotifs = showAllUpdatesGlobal ? notifications : notifications.filter((n) => !n.isRead);
  const globalUnreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredChannels = channels.filter((ch) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return ch.channelName.toLowerCase().includes(q) || ch.channelHandle?.toLowerCase().includes(q);
  });

  const unreadCountFor = (channelId: string) =>
    notifications.filter((n) => n.channelId === channelId && !n.isRead).length;

  const channelPercent = Math.min(100, (capacity.channelsUsed / capacity.channelsLimit) * 100);
  const unitsPercent = Math.min(100, (capacity.unitsUsedPerCheck / capacity.unitsLimit) * 100);

  const todayUpdatesCount = notifications.filter((n) => {
    const notifDate = new Date(n.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return notifDate === todayDate;
  }).length;

  // Quick-exclude suggestions
  const quickExcludes = ['Sub', 'English Dub', 'Tamil dub', 'Telugu dub', 'English sub', 'Hindi dub', 'Tamil sub', 'Telugu sub', 'Preview', 'EN Sub'];

  const addToExclude = (channelId: string, word: string) => {
    setExcludeKeywordsInputs(prev => {
      const current = prev[channelId] || '';
      const items = current.split(',').map(s => s.trim()).filter(Boolean);
      if (!items.includes(word)) {
        const newValue = items.length ? items.join(', ') + ', ' + word : word;
        return { ...prev, [channelId]: newValue };
      }
      return prev;
    });
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        {Icon.spinner('w-8 h-8 text-purple-400')}
      </div>
    );

  // ============ NOTIFICATION CARD ============
  const NotifCard = ({ n, showChannelTag }: { n: TrackNotification; showChannelTag: boolean }) => (
    <div
      key={n._id}
      className={`rounded-xl border p-3 ${
        n.isRead ? 'bg-black/10 border-white/5 opacity-60' : 'bg-black/30 border-purple-500/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {n.oldThumbnail && (
          <div className="flex-shrink-0 text-center">
            <img src={n.oldThumbnail} className="w-20 h-12 object-cover rounded-lg border border-white/10 opacity-60" />
            <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold">Old · Part {n.oldPart ?? '?'}</p>
          </div>
        )}

        {n.oldThumbnail && <div className="flex-shrink-0 self-center text-slate-500">→</div>}

        {n.newThumbnail && (
          <div className="flex-shrink-0 text-center">
            <img src={n.newThumbnail} className="w-20 h-12 object-cover rounded-lg border border-emerald-500/40" />
            <p className="text-[9px] text-emerald-400 mt-1 uppercase font-semibold">New · Part {n.newPart}</p>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5 flex-wrap">
            {n.titleKeyword || n.channelName}
            {n.notifType === 'needs_approval' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Approval Chahiye</span>
            )}
            {n.notifType === 'season_change' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Season Change</span>
            )}
            {n.notifType === 'limit_reached' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">Limit Reached</span>
            )}
            {n.notifType === 'manual_review' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Manual Review</span>
            )}
            {n.notifType === 'auto_paused' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-600/40 flex items-center gap-1">
                {Icon.ban('w-2.5 h-2.5')} Auto-Paused
              </span>
            )}
            {n.autoAdded && !n.undone && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                {Icon.check('w-2.5 h-2.5')} Auto-Added
              </span>
            )}
            {n.undone && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1">
                {Icon.undo('w-2.5 h-2.5')} Undone
              </span>
            )}
          </p>
          {n.newVideoTitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.newVideoTitle}</p>}
          {showChannelTag && <p className="text-[10px] text-slate-600 mt-0.5">{n.channelName}</p>}
          <p className="text-[10px] text-slate-600 mt-0.5">{formatIST(n.createdAt)}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {n.newVideoUrl && (
              <a
                href={n.newVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition flex items-center gap-1"
              >
                {Icon.play('w-3 h-3')} Watch
              </a>
            )}
            {n.newVideoUrl && (
              <button
                onClick={() => shareVideo(n.newVideoUrl)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition flex items-center gap-1"
              >
                {Icon.share('w-3 h-3')} Share Link
              </button>
            )}
            {n.notifType === 'season_change' && !n.isRead && (
              <button
                onClick={() => resolveSeasonChange(n)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
              >
                {Icon.clapperboard('w-3 h-3')} Naya Season Page
              </button>
            )}
            {n.notifType === 'needs_approval' && !n.isRead && (
              <button
                onClick={() => {
                  const channel = channels.find(ch => (ch.titles || []).some((t: any) => t.keyword === n.titleKeyword));
                  const title = channel?.titles.find((t: any) => t.keyword === n.titleKeyword) as any;
                  if (channel && title) openBrowseTitle(channel._id, title.id, title.keyword);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition flex items-center gap-1"
              >
                {Icon.eye('w-3 h-3')} Approve Karo
              </button>
            )}
            {n.autoAdded && !n.undone && n.linkedDownloadPageId && (
              <button
                onClick={() => {
                  // Use the new undo modal
                  setNotificationDeleteConfirm({
                    notificationId: `undo-${n._id}`,
                    title: n.titleKeyword || n.channelName,
                    isBulk: false,
                  });
                }}
                disabled={!!undoing[n._id]}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition flex items-center gap-1 disabled:opacity-50"
              >
                {undoing[n._id] ? Icon.spinner('w-3 h-3') : Icon.undo('w-3 h-3')} Undo
              </button>
            )}
            {n.notifType === 'auto_paused' && (
              <button
                onClick={() => {
                  const channel = channels.find(ch => ch.channelId === n.channelId);
                  if (channel) setSelectedChannelId(channel._id);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition"
              >
                Channel Dekho
              </button>
            )}
            {!n.isRead && (
              <button
                onClick={() => markDone(n._id)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition ml-auto flex items-center gap-1"
              >
                {Icon.check('w-3 h-3')} Mark as Done
              </button>
            )}
            {n.isRead && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-500 ml-auto">Done</span>
            )}
            <button
              onClick={() => deleteNotification(n._id)}
              className="text-[11px] p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-300 transition"
              title="Permanently Remove"
            >
              {Icon.trash('w-3 h-3')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ============ SHARED BROWSE PANEL ============
  const renderBrowsePanel = (channelId: string, titleId: string) => {
    if (!(browsingTitle?.titleId === titleId && browsingTitle?.channelId === channelId)) return null;
    return (
      <div className="mt-2 bg-black/30 border border-white/10 rounded-xl overflow-hidden">
        {browseLoading ? (
          <div className="flex justify-center py-6">{Icon.spinner('w-5 h-5 text-purple-400')}</div>
        ) : browseData ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
              <div>
                <h4 className="text-sm font-semibold text-white">{browseData.keyword}</h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                  <span>{browseData.videos.length} video(s) · last known part: {browseData.lastKnownPart}</span>
                  {!browseData.initialized && (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      {Icon.clock('w-3 h-3')} Approval Pending
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={scanBrowseDeeper}
                  disabled={browseLoading}
                  className="text-[10px] px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center gap-1"
                >
                  {Icon.chevron('w-3 h-3')} Purane Bhi Dhoondo
                </button>
                <button onClick={closeBrowseTitle} className="text-slate-400 hover:text-white p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 bg-black/10 border-b border-white/5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableDropdown
                    options={animeOptions}
                    value={animeOptions.find(a => a._id === bulkAnimeId) || null}
                    onChange={(opt) => fetchBulkPages(opt?._id || '')}
                    placeholder="-- Anime select karo --"
                  />
                </div>
                <select value={bulkPageId} onChange={(e) => setBulkPageId(e.target.value)} disabled={!bulkAnimeId} className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-50">
                  <option value="">-- Page select karo --</option>
                  {bulkPages.map((p: any, idx: number) => <option key={p._id} value={p._id}>{pageLabel(idx)}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={selectAllVideos} className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition">
                    {browseData.videos?.every((v: any) => selectedVideoIds.has(v.videoId)) ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-slate-400">{selectedVideoIds.size} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={bulkIgnoreSelected}
                    disabled={selectedVideoIds.size === 0 || bulkIgnoring}
                    className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-xs rounded-lg font-semibold flex items-center gap-1"
                  >
                    {bulkIgnoring && Icon.spinner('w-3 h-3')} Selected Ignore Karo
                  </button>
                  <button
                    onClick={doBulkAdd}
                    disabled={!bulkPageId || selectedVideoIds.size === 0}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs rounded-lg font-semibold"
                  >
                    Selected Ko Is Page Me Add Karo
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 flex items-start gap-1">
                <span className="mt-0.5">{Icon.info('w-3 h-3 flex-shrink-0')}</span>
                <span>Agar system ne galat/koi part number detect nahi kiya, uss video ke "Ep #" box me sahi number khud daal do — waisa hi add hoga. Video card kahin bhi click karke bhi select/deselect ho jayega.</span>
              </p>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-3 space-y-2">
              {browseData.videos.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Koi video nahi mila.</p>
              ) : (
                browseData.videos.map((v: any) => {
                  const isSelected = selectedVideoIds.has(v.videoId);
                  return (
                    <div
                      key={v.videoId}
                      onClick={() => toggleVideoSelect(v.videoId)}
                      className={`rounded-lg p-2 border cursor-pointer transition ${
                        isSelected ? 'bg-purple-500/10 border-purple-500/40' : 'bg-black/20 hover:bg-black/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVideoSelect(v.videoId)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 flex-shrink-0"
                        />
                        <img src={v.thumbnail} className="w-16 h-9 object-cover rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white truncate">{v.videoTitle}</p>
                          <p className="text-[9px] text-slate-500">
                            {v.part !== null ? (
                              <span className={v.isRange ? 'text-sky-400' : 'text-emerald-400'}>
                                Part: {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                              </span>
                            ) : (
                              <span className="text-amber-400">Part detect nahi hua</span>
                            )}
                            {formatDuration(v.durationSec) && (
                              <span className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}> · {formatDuration(v.durationSec)}</span>
                            )}
                            {v.matchedFormat && ` · ${v.matchedFormat}`}
                          </p>
                        </div>
                        <input
                          type="number"
                          placeholder={v.part !== null ? String(v.part) : 'Ep #'}
                          value={episodeOverrides[v.videoId] ?? ''}
                          onChange={(e) => setEpisodeOverrides(prev => ({ ...prev, [v.videoId]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          title="Manual episode number override — yahan likha number hi save hoga"
                          className="w-16 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-1.5 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedInfoId(prev => prev === v.videoId ? null : v.videoId); }}
                          className="text-[10px] text-slate-400 hover:text-white flex-shrink-0"
                        >
                          {expandedInfoId === v.videoId ? 'Less' : 'More'}
                        </button>
                        <a href={v.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-sky-400 hover:text-sky-300 flex-shrink-0">Watch</a>
                        <button onClick={(e) => { e.stopPropagation(); ignoreVideo(v.videoId); }} className="text-[10px] text-red-400 hover:text-red-300 flex-shrink-0">Ignore</button>
                      </div>

                      {expandedInfoId === v.videoId && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 pl-7">
                          <p className="text-slate-500 mb-1.5">{formatIST(v.publishedAt)}</p>
                          <p className="whitespace-pre-wrap max-h-40 overflow-y-auto">{v.description || 'No description available.'}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!browseData.initialized && (
              <div className="p-3 border-t border-white/10 bg-amber-500/5">
                <p className="text-[10px] text-amber-300 mb-2">Sab episodes add karne ke baad "Approve & Finalize" dabao, fir auto-tracking chalu ho jayega.</p>
                <button
                  onClick={finalizeApproval}
                  disabled={finalizing}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  {finalizing ? 'Finalizing...' : (<>{Icon.checkAll('w-3.5 h-3.5')} Approve & Finalize (ab auto-tracking shuru ho)</>)}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-6">Failed to load data</p>
        )}
      </div>
    );
  };

  // ============ SHARED CHANNEL DETAIL PANEL (accordion body) ============
  const renderChannelDetail = (ch: TrackedChannel) => (
    <div className="border-t border-white/10 bg-black/20 p-4 space-y-5">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => togglePause(ch._id)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1.5 ${
            ch.paused
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
          }`}
        >
          {ch.paused ? Icon.play('w-3.5 h-3.5') : Icon.pause('w-3.5 h-3.5')}
          {ch.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => checkNow(ch._id)}
          disabled={checkingNow[ch._id]}
          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1.5"
        >
          {checkingNow[ch._id] ? Icon.spinner('w-3.5 h-3.5') : Icon.play('w-3.5 h-3.5')}
          Check Now
        </button>
        <button
          onClick={() => refreshChannelInfo(ch._id)}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center gap-1.5"
        >
          {Icon.refresh('w-3.5 h-3.5')} Refresh Info
        </button>
        {/* Channel Feed toggle button */}
        <button
          onClick={() => setShowChannelFeed(prev => ({ ...prev, [ch._id]: !prev[ch._id] }))}
          className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1.5 ${
            showChannelFeed[ch._id]
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
          }`}
        >
          {Icon.bell('w-3.5 h-3.5')} Channel Feed
        </button>
        <button
          onClick={() => removeChannel(ch._id, ch.channelName)}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1.5 ml-auto"
        >
          {Icon.trash('w-3.5 h-3.5')} Remove Channel
        </button>
      </div>

      {/* Tracked Titles – always visible */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3" id={`titles-${ch._id}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            {Icon.eye('w-3.5 h-3.5 text-sky-400')} Tracked Titles ({ch.titles.length})
          </h4>
          <button
            onClick={() => setBulkModeChannel(bulkModeChannel === ch._id ? null : ch._id)}
            className="text-[11px] text-purple-300 hover:text-purple-200 transition"
          >
            {bulkModeChannel === ch._id ? 'Single add pe wapas jao' : 'Bulk add karo (multiple lines)'}
          </button>
        </div>

        {bulkModeChannel === ch._id ? (
          <div className="mb-3 space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Har line pe ek series naam likho, jaise:\nNaruto\nOne Piece\nBleach'}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              onClick={() => addBulkTitles(ch._id)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1"
            >
              {Icon.plus('w-3.5 h-3.5')} Sabhi Add Karo
            </button>
          </div>
        ) : (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={titleInputs[ch._id] || ''}
                onChange={(e) => {
                  setTitleInputs({ ...titleInputs, [ch._id]: e.target.value });
                  setPreviewResults(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addTitle(ch._id)}
                placeholder="Naya series naam (jaise 'Naruto')"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <select
                value={previewScanDepth}
                onChange={(e) => setPreviewScanDepth(Number(e.target.value))}
                title="Kitne recent videos scan karne hain"
                className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={1500}>1500</option>
                <option value={3000}>3000</option>
                <option value={5000}>5000</option>
              </select>
              <button
                onClick={() => { openPreview(ch._id); runPreview(ch._id); }}
                disabled={previewLoading}
                className="px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs font-medium text-sky-300 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                title="Add karne se pehle preview karo ki abhi konse videos is keyword se match ho rahe hain"
              >
                {previewLoading && previewForChannel === ch._id ? Icon.spinner('w-3.5 h-3.5') : Icon.search('w-3.5 h-3.5')}
                Preview
              </button>
              <button
                onClick={() => addTitle(ch._id)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 rounded-lg transition flex items-center gap-1"
              >
                {Icon.plus('w-3.5 h-3.5')} Add
              </button>
            </div>

            <input
              value={excludeKeywordsInputs[ch._id] || ''}
              onChange={(e) => setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [ch._id]: e.target.value })}
              placeholder="Exclude karo (comma se alag karo): Sub, English Dub, Tamil, Telugu"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />

            {/* Quick-exclude chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickExcludes.map((word) => (
                <button
                  key={word}
                  onClick={() => addToExclude(ch._id, word)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
                >
                  + {word}
                </button>
              ))}
            </div>

            {previewForChannel === ch._id && previewResults && (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-2 space-y-2">
                <p className="text-[11px] text-sky-300 font-semibold px-1 flex items-center justify-between">
                  <span>{previewResults.matchedCount} video(s) match hue</span>
                  <button
                    onClick={() => scanPreviewDeeper(ch._id)}
                    disabled={previewLoading}
                    className="text-[10px] px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center gap-1"
                  >
                    {Icon.chevron('w-3 h-3')} {previewLoading ? 'Scanning...' : 'Purane Episodes Bhi Dhoondo'}
                  </button>
                </p>

                {previewResults.videos.length === 0 ? (
                  <p className="text-[11px] text-amber-400 px-1">Koi video match nahi hua — keyword thoda broad/exact karke dekho.</p>
                ) : (
                  <>
                    <div className="bg-black/20 rounded-lg p-2 space-y-1.5">
                      <div className="flex gap-1.5">
                        <div className="flex-1">
                          <SearchableDropdown
                            options={animeOptions}
                            value={animeOptions.find(a => a._id === previewBulkAnimeId) || null}
                            onChange={(opt) => fetchPreviewBulkPages(opt?._id || '')}
                            placeholder="-- Anime search karo --"
                          />
                        </div>
                        <select
                          value={previewBulkPageId}
                          onChange={(e) => setPreviewBulkPageId(e.target.value)}
                          disabled={!previewBulkAnimeId}
                          className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-white disabled:opacity-50"
                        >
                          <option value="">-- Page select karo --</option>
                          {previewBulkPages.map((p: any, idx: number) => <option key={p._id} value={p._id}>{pageLabel(idx)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={selectAllPreviewVideos} className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition">
                            {previewResults.videos.every(v => previewSelectedIds.has(v.videoId)) ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-[11px] text-slate-400">{previewSelectedIds.size} selected</span>
                        </div>
                        <button
                          onClick={() => doPreviewBulkAdd(ch._id)}
                          disabled={!previewBulkPageId || previewSelectedIds.size === 0 || previewAdding}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[11px] rounded-lg font-semibold flex items-center gap-1"
                        >
                          {previewAdding && Icon.spinner('w-3 h-3')} Selected Ko Is Page Me Add Karo
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto space-y-1.5">
                      {previewResults.videos.map(v => {
                        const isSelected = previewSelectedIds.has(v.videoId);
                        return (
                          <div
                            key={v.videoId}
                            onClick={() => togglePreviewVideoSelect(v.videoId)}
                            className={`rounded-lg p-1.5 border cursor-pointer transition ${
                              isSelected ? 'bg-purple-500/10 border-purple-500/40' : 'bg-black/20 hover:bg-black/30 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePreviewVideoSelect(v.videoId)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3.5 h-3.5 flex-shrink-0"
                              />
                              <img src={v.thumbnail} className="w-12 h-7 object-cover rounded flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white truncate">{v.videoTitle}</p>
                                <p className="text-[9px] text-slate-500 flex items-center gap-1.5">
                                  {v.part !== null ? (
                                    <span className={v.isRange ? 'text-sky-400' : 'text-emerald-400'}>
                                      Part: {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                                    </span>
                                  ) : (
                                    <span className="text-amber-400">Part detect nahi hua</span>
                                  )}
                                  {formatDuration(v.durationSec) && (
                                    <span className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}>· {formatDuration(v.durationSec)}</span>
                                  )}
                                </p>
                              </div>
                              <input
                                type="number"
                                placeholder={v.part !== null ? String(v.part) : 'Ep #'}
                                value={previewEpisodeOverrides[v.videoId] ?? ''}
                                onChange={(e) => setPreviewEpisodeOverrides(prev => ({ ...prev, [v.videoId]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                title="Manual episode number override"
                                className="w-14 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-1 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedInfoId(prev => prev === v.videoId ? null : v.videoId); }}
                                className="text-[9px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 flex-shrink-0 flex items-center gap-0.5"
                              >
                                {expandedInfoId === v.videoId ? 'Less' : 'More'} {Icon.chevron('w-2.5 h-2.5')}
                              </button>
                            </div>

                            {expandedInfoId === v.videoId && (
                              <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300">
                                <p className="text-slate-500 mb-1.5 flex items-center gap-2">
                                  <span>{formatIST(v.publishedAt)}</span>
                                  <a
                                    href={`https://youtube.com/watch?v=${v.videoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sky-400 hover:text-sky-300 underline"
                                  >
                                    Open on YouTube
                                  </a>
                                </p>
                                <p className="whitespace-pre-wrap max-h-40 overflow-y-auto">
                                  {v.description || 'No description available.'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Title cards list */}
        <div className="space-y-2">
          {ch.titles.length === 0 && (
            <p className="text-xs text-slate-500">Abhi koi title track nahi ho raha.</p>
          )}
          {ch.titles.map((t) => {
            const anyT = t as any;
            return editingTitle === t.id ? (
              <div key={t.id} className="flex items-center gap-2 bg-black/20 rounded-lg p-2 border border-white/5">
                <input
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                  placeholder="Series naam"
                  className="bg-gray-800/60 border border-gray-700 rounded px-2 py-1 text-xs text-white w-36"
                />
                <input
                  value={editLastPart}
                  onChange={(e) => setEditLastPart(e.target.value)}
                  placeholder="Last part"
                  type="number"
                  className="bg-gray-800/60 border border-gray-700 rounded px-2 py-1 text-xs text-white w-16"
                />
                <button
                  onClick={() => saveEditTitle(ch._id, t.id)}
                  className="text-emerald-400 hover:text-emerald-300 p-1"
                >
                  {Icon.check('w-3.5 h-3.5')}
                </button>
                <button onClick={cancelEditTitle} className="text-slate-400 hover:text-red-400 p-1">
                  {Icon.trash('w-3.5 h-3.5')}
                </button>
              </div>
            ) : (
              <div key={t.id} className="bg-black/20 rounded-xl p-3 border border-white/5 hover:border-white/10 transition">
                {/* ============ REPLACED TITLE CARD SECTION ============ */}
                <div className="flex items-start justify-between gap-2">
                  {/* NEW: Left side with full title and linked anime info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white break-words" title={t.keyword}>
                        {t.keyword}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 flex-shrink-0">
                        last part: {t.lastKnownPart}
                      </span>
                      {anyT.initialized === false && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 flex-shrink-0">
                          {Icon.clock('w-2.5 h-2.5')} Approval Pending
                        </span>
                      )}
                    </div>

                    {/* ✅ NEW — linked anime ka pura naam + thumbnail, apni alag line pe */}
                    {anyT.linkedDownloadPageId && (() => {
                      const linkedAnime = animeOptions.find(a => a._id === anyT.linkedAnimeId);
                      return (
                        <div className="mt-1.5 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-1.5">
                          {linkedAnime?.thumbnail && (
                            <img src={linkedAnime.thumbnail} className="w-8 h-11 object-cover rounded flex-shrink-0" alt="" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] text-emerald-300 font-medium break-words flex items-center gap-1">
                              {Icon.link('w-2.5 h-2.5 flex-shrink-0')} {linkedAnime?.title || 'Linked Anime'}
                            </p>
                            <p className="text-[10px] text-emerald-400/70">Limit: {anyT.episodeLimit || 'Unlimited'}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEditTitle(t)}
                      className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition"
                      title="Edit title"
                    >
                      {Icon.edit('w-3.5 h-3.5')}
                    </button>
                    <button
                      onClick={() => removeTitle(ch._id, t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Remove title"
                    >
                      {Icon.trash('w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => openBrowseTitle(ch._id, t.id, t.keyword)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition flex items-center gap-1"
                  >
                    {Icon.eye('w-3 h-3')} Saare Episodes Dekho
                  </button>

                  {!anyT.linkedDownloadPageId ? (
                    <button
                      onClick={() => openLinkForm(t)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition flex items-center gap-1"
                    >
                      {Icon.plus('w-2.5 h-2.5')} Page se link karo (auto-add ke liye)
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openLinkForm(t)}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition"
                      >
                        Edit Link
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-with-page`,
                              {}, authHeaders()
                            );
                            if (data.success) {
                              toast.success(`Sync ho gaya — ab last known part: ${data.syncedToPart}`);
                              loadData();
                            } else {
                              toast.error(data.error || 'Sync fail ho gaya');
                            }
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || 'Sync fail ho gaya');
                          }
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition"
                      >
                        ^_~ Page Se Sync 
                      </button>
                      {/* ✅ NEW — Episode Status Manager wala currentEpisode manually update karne ke liye */}
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-episode-status`,
                              {}, authHeaders()
                            );
                            if (data.success) {
                              toast.success(`Episode Status update ho gaya — Current Episode: ${data.currentEpisode}`);
                            } else {
                              toast.error(data.error || 'Episode Status update fail ho gaya');
                            }
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || 'Episode Status update fail ho gaya');
                          }
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition"
                      >
                        Ep Status Update
                      </button>
                      <button
                        onClick={() => unlinkTitle(ch._id, t.id)}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition"
                      >
                        Unlink
                      </button>
                    </div>
                  )}
                </div>

                {linkFormTitleId === t.id && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="p-3 bg-black/40 border border-purple-500/30 rounded-xl space-y-2 w-full">
                      <div>
                        <SearchableDropdown
                          options={animeOptions}
                          value={animeOptions.find(a => a._id === linkAnimeId) || null}
                          onChange={(opt) => {
                            setLinkAnimeId(opt?._id || '');
                            setLinkPageId('');
                            fetchPagesForAnime(opt?._id || '');
                          }}
                          placeholder="-- Anime select karo --"
                        />
                      </div>

                      <select
                        value={linkPageId}
                        onChange={(e) => setLinkPageId(e.target.value)}
                        disabled={!linkAnimeId}
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        <option value="">-- Download Page select karo --</option>
                        {pagesForAnime.map((p, idx) => (
                          <option key={p._id} value={p._id}>
                            {pageLabel(idx)} ({(p.links || []).filter((l: any) => l.type === 'watch').length} watch links)
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        value={linkLimit}
                        onChange={(e) => setLinkLimit(e.target.value)}
                        placeholder="Episode limit (0 = unlimited)"
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      />

                      <input
                        type="number"
                        min="1"
                        value={linkBaselineMin}
                        onChange={(e) => setLinkBaselineMin(e.target.value)}
                        placeholder="Ek normal episode kitne minute ka hai? (optional)"
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                      <p className="text-[10px] text-slate-500">
                        Jab title/description me number na mile, tab duration se merge guess karega (auto-add nahi karega, sirf review notification dega)
                      </p>

                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={linkMergeMode}
                          onChange={(e) => setLinkMergeMode(e.target.checked)}
                        />
                        Compilation Merge Mode (1-2 → 1-5 jaisi range videos ka purana link auto-replace karo)
                      </label>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveLinkForm(ch._id)}
                          disabled={savingLink || !linkPageId}
                          className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={closeLinkForm}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {renderBrowsePanel(ch._id, t.id)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel Updates Feed – hidden by default, toggled via the "Channel Feed" button */}
      {showChannelFeed[ch._id] && (
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              {Icon.bell('w-3.5 h-3.5 text-emerald-400')} Is Channel Ki Feed
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => markAllDoneInList(pendingChannelNotifs)}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 transition flex items-center gap-1"
              >
                {Icon.checkAll('w-3.5 h-3.5')} Sabko Done Karo
              </button>
              <button
                onClick={() => deleteAllInList(pendingChannelNotifs)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1"
              >
                {Icon.trash('w-3.5 h-3.5')} Sabhi Remove Karo
              </button>
              <button
                onClick={() => setShowAllUpdates((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
              >
                {showAllUpdates ? 'Sirf Pending' : 'Sab Dikhao'}
              </button>
            </div>
          </div>

          {pendingChannelNotifs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Is channel ke liye koi naya update nahi hai abhi</p>
          ) : (
            <div className="space-y-3">
              {pendingChannelNotifs.map((n) => (
                <NotifCard key={n._id} n={n} showChannelTag={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* ✅ NEW — Custom styled channel delete confirmation modal (no browser confirm popup) */}
      {channelDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/20 rounded-xl">
                {Icon.trash('w-5 h-5 text-red-300')}
              </div>
              <h3 className="text-lg font-bold text-white">Channel Remove Karo</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              <span className="text-white font-semibold">"{channelDeleteConfirm.channelName}"</span> aur uske saare tracked titles hamesha ke liye remove ho jayenge. Ye action wapas nahi ho sakta.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setChannelDeleteConfirm(null)}
                disabled={deletingChannel}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChannel}
                disabled={deletingChannel}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-white font-medium transition shadow-lg shadow-red-600/20 flex items-center gap-2"
              >
                {deletingChannel && Icon.spinner('w-3.5 h-3.5')}
                Remove Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW — Custom styled notification delete confirmation modal */}
      {notificationDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/20 rounded-xl">
                {Icon.trash('w-5 h-5 text-red-300')}
              </div>
              <h3 className="text-lg font-bold text-white">
                {notificationDeleteConfirm.isBulk ? 'Sabhi Remove Karo' : 'Update Remove Karo'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              {notificationDeleteConfirm.isBulk ? (
                <>
                  <span className="text-white font-semibold">{notificationDeleteConfirm.count}</span> updates hamesha ke liye remove ho jayenge. Ye action wapas nahi ho sakta.
                </>
              ) : (
                <>
                  <span className="text-white font-semibold">"{notificationDeleteConfirm.title}"</span> ka ye update hamesha ke liye remove ho jayega. Ye action wapas nahi ho sakta.
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setNotificationDeleteConfirm(null)}
                disabled={deletingNotification}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (notificationDeleteConfirm.notificationId === 'all-logs') {
                    confirmClearLogs();
                  } else if (notificationDeleteConfirm.notificationId === 'all-runs') {
                    confirmClearRuns();
                  } else if (notificationDeleteConfirm.notificationId === 'bulk-notifications') {
                    confirmBulkDeleteNotifications();
                  } else if (notificationDeleteConfirm.notificationId.startsWith('undo-')) {
                    confirmUndoNotification();
                  } else {
                    confirmDeleteNotification();
                  }
                }}
                disabled={deletingNotification}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-white font-medium transition shadow-lg shadow-red-600/20 flex items-center gap-2"
              >
                {deletingNotification && Icon.spinner('w-3.5 h-3.5')}
                {notificationDeleteConfirm.notificationId.startsWith('undo-') ? 'Undo Karo' : 'Remove Karo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Header ---------- */}
      <div className="flex items-center gap-3">
        <span className="text-red-500">{Icon.youtube('w-8 h-8')}</span>
        <div>
          <h3 className="text-xl font-bold text-white">YouTube Track Manager</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Channels aur series select karo – naye episode upload hote hi notification milegi.
          </p>
        </div>
      </div>

      {/* ---------- NEW: Overview Stats Card ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 rounded-xl">{Icon.youtube('w-5 h-5 text-purple-300')}</div>
          <div>
            <p className="text-2xl font-bold text-white">{channels.length}</p>
            <p className="text-xs text-slate-400">Total Channels</p>
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/20 rounded-xl">{Icon.eye('w-5 h-5 text-sky-300')}</div>
          <div>
            <p className="text-2xl font-bold text-white">{allTitlesFlat.length}</p>
            <p className="text-xs text-slate-400">Total Tracked Titles</p>
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 rounded-xl">{Icon.bell('w-5 h-5 text-emerald-300')}</div>
          <div>
            <p className="text-2xl font-bold text-white">{todayUpdatesCount}</p>
            <p className="text-xs text-slate-400">Aaj Ke Updates</p>
          </div>
        </div>
      </div>

      {/* ---------- Capacity Meters ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Channels Tracked</span>
            <span className="text-purple-300 font-semibold">
              {capacity.channelsUsed} / {capacity.channelsLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${channelPercent}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">YouTube API Units (per cycle)</span>
            <span className="text-sky-300 font-semibold">
              {capacity.unitsUsedPerCheck} / {capacity.unitsLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${unitsPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ============ ADD CHANNEL — separate card ============ */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <label className="block text-xs font-semibold text-slate-400 mb-2">Naya Channel Add Karo</label>
        <div className="flex gap-2">
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addChannel()}
            placeholder="@channelhandle"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
          />
          <button
            onClick={addChannel}
            disabled={adding}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-lg shadow-purple-600/20 flex items-center gap-2"
          >
            {adding ? Icon.spinner() : Icon.plus()}
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* ============ UNIFIED ROW: Conflicts | All Updates | All Titles ============ */}
      <div>
        {/* Buttons row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => {
              setShowConflicts((v) => !v);
              if (!showConflicts) { setShowGlobalFeed(false); setShowAllTitles(false); }
            }}
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showConflicts ? 'ring-2 ring-amber-500/50' : ''
            }`}
          >
            <div className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
              showConflicts ? 'bg-amber-500/10 border-b border-amber-500/20' : ''
            }`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.conflict('w-4 h-4 text-amber-300')}
                <span>Conflicts</span>
                {conflicts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    {conflicts.length}
                  </span>
                )}
              </div>
              <span className={`text-slate-400 transition-transform ${showConflicts ? 'rotate-180' : ''}`}>
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setShowGlobalFeed((v) => !v);
              if (!showGlobalFeed) { setShowConflicts(false); setShowAllTitles(false); }
            }}
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showGlobalFeed ? 'ring-2 ring-rose-500/50' : ''
            }`}
          >
            <div className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
              showGlobalFeed ? 'bg-rose-500/10 border-b border-rose-500/20' : ''
            }`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.bell('w-4 h-4 text-rose-300')}
                <span>All Updates</span>
                {globalUnreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                    {globalUnreadCount}
                  </span>
                )}
              </div>
              <span className={`text-slate-400 transition-transform ${showGlobalFeed ? 'rotate-180' : ''}`}>
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setShowAllTitles((v) => !v);
              if (showAllTitles) closeBrowseTitle();
              if (!showAllTitles) { setShowConflicts(false); setShowGlobalFeed(false); }
            }}
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showAllTitles ? 'ring-2 ring-sky-500/50' : ''
            }`}
          >
            <div className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
              showAllTitles ? 'bg-sky-500/10 border-b border-sky-500/20' : ''
            }`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.eye('w-4 h-4 text-sky-300')}
                <span>All Titles</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-semibold">
                  {allTitlesFlat.length}
                </span>
              </div>
              <span className={`text-slate-400 transition-transform ${showAllTitles ? 'rotate-180' : ''}`}>
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>
        </div>

        {showConflicts && (
          <div className="mt-3 bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto">
            {conflicts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4 flex items-center justify-center gap-1.5">
                {Icon.checkAll('w-4 h-4 text-emerald-400')} Koi conflict nahi
              </p>
            ) : (
              <div className="space-y-2">
                {conflicts.map((cf) => (
                  <div key={cf.pageId} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                      {Icon.file('w-3.5 h-3.5')} {cf.slug} — {cf.titles.length} titles
                    </p>
                    <div className="space-y-1">
                      {cf.titles.map((t) => (
                        <div key={`${t.channelId}-${t.titleId}`} className="flex items-center justify-between text-[11px] bg-black/20 rounded-lg px-2 py-1.5">
                          <span className="text-slate-300 truncate">
                            "{t.keyword}" <span className="text-slate-500">· {t.channelName}</span>
                          </span>
                          <button
                            onClick={() => setSelectedChannelId(t.channelId)}
                            className="text-purple-300 hover:text-purple-200 underline text-[10px] flex-shrink-0 ml-2"
                          >
                            Channel
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showGlobalFeed && (
          <div className="mt-3 bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-end gap-2 flex-wrap mb-3">
              <button
                onClick={() => markAllDoneInList(pendingGlobalNotifs)}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 transition flex items-center gap-1"
              >
                {Icon.checkAll('w-3 h-3')} Done
              </button>
              <button
                onClick={() => deleteAllInList(pendingGlobalNotifs)}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1"
              >
                {Icon.trash('w-3 h-3')} Remove
              </button>
              <button
                onClick={() => setShowAllUpdatesGlobal((v) => !v)}
                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
              >
                {showAllUpdatesGlobal ? 'Pending' : 'All'}
              </button>
            </div>

            <div className="space-y-3">
              {pendingGlobalNotifs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Koi naya update nahi</p>
              ) : (
                pendingGlobalNotifs.map((n) => <NotifCard key={n._id} n={n} showChannelTag />)
              )}
            </div>
          </div>
        )}

        {showAllTitles && (
          <div className="mt-3 bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
            <div className="relative mb-3">
              {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2')}
              <input
                value={allTitlesSearch}
                onChange={(e) => setAllTitlesSearch(e.target.value)}
                placeholder="Search title or channel..."
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="space-y-2">
              {filteredAllTitles.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  {allTitlesSearch ? 'No title found' : 'No titles tracked yet'}
                </p>
              ) : (
                filteredAllTitles.map((t: any) => {
                  const isExpanded = browsingTitle?.titleId === t.id && browsingTitle?.channelId === t.channelId;
                  return (
                    <div key={`${t.channelId}-${t.id}`}>
                      <button
                        onClick={() => openBrowseTitle(t.channelId, t.id, t.keyword)}
                        className="w-full flex items-center justify-between bg-black/20 hover:bg-black/40 rounded-lg px-3 py-2 text-left transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {t.channelThumbnail ? (
                              <img src={t.channelThumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400">
                                {t.channelName?.charAt(0).toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">{t.keyword}</p>
                            <p className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                              <span>{t.channelName} · part {t.lastKnownPart}</span>
                              {t.initialized === false && <span className="text-amber-400">{Icon.clock('w-2.5 h-2.5')}</span>}
                            </p>
                          </div>
                        </div>
                        <span className={`text-slate-500 flex-shrink-0 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          {Icon.chevron('w-3.5 h-3.5')}
                        </span>
                      </button>
                      {renderBrowsePanel(t.channelId, t.id)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Tracked Channels (accordion list) ---------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            {Icon.eye('w-4 h-4 text-sky-400')} Tracked Channels
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium">
              {channels.length}
            </span>
            <div className="relative">
              {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2')}
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Channel dhoondo..."
                className="w-48 bg-gray-800/60 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>
        </div>

        {channels.length === 0 ? (
          <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
            <p className="text-slate-500 text-sm">Koi channel track nahi ho raha</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
            <p className="text-slate-500 text-sm">Is naam ka koi channel nahi mila</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChannels.map((ch) => {
              const unread = unreadCountFor(ch.channelId);
              const isOpen = selectedChannelId === ch._id;
              return (
                <div
                  key={ch._id}
                  className={`bg-slate-800/30 backdrop-blur-xl border rounded-2xl overflow-hidden transition-colors ${
                    isOpen ? 'border-purple-500/40' : 'border-white/10'
                  }`}
                >
                  <button
                    onClick={() => setSelectedChannelId(isOpen ? null : ch._id)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition ${
                      isOpen ? 'bg-purple-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center overflow-hidden">
                        {ch.channelThumbnail ? (
                          <img src={ch.channelThumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-slate-400 font-bold">
                            {ch.channelName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-slate-900">
                          {unread}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm truncate" title={ch.channelName}>{ch.channelName}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-medium">
                          {ch.titles.length} titles
                        </span>
                        {ch.paused && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium flex items-center gap-1">
                            {Icon.pause('w-2.5 h-2.5')} Paused
                          </span>
                        )}
                        {!!ch.consecutiveErrors && ch.consecutiveErrors > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium flex items-center gap-1">
                            {Icon.warn('w-2.5 h-2.5')} {ch.consecutiveErrors} error{ch.consecutiveErrors > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      {Icon.chevron('w-4 h-4')}
                    </span>
                  </button>

                  {isOpen && renderChannelDetail(ch)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Run History ---------- */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div
          onClick={() => setShowRunHistory(v => !v)}
          className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition"
        >
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            {Icon.history('w-4 h-4 text-slate-400')} Run History
            {runs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-medium">
                {runs.length}
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={runAllNow}
              disabled={runningAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {runningAll ? Icon.spinner('w-3.5 h-3.5') : Icon.play('w-3.5 h-3.5')}
              Test Run
            </button>
            {runs.length > 0 && (
              <button
                onClick={clearAllRuns}
                disabled={clearingRuns}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {clearingRuns ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                Clear
              </button>
            )}
          </div>
        </div>
        {showRunHistory && (
          <div className="p-4">
            {runs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Abhi tak koi automatic run nahi hua — cron din me 2 baar (8 AM, 8 PM IST) chalega.
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {runs.map((r) => (
                  <div key={r._id} className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2.5 text-xs border border-white/5">
                    <span className="text-slate-400 flex-shrink-0">{formatIST(r.runAt)}</span>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {r.channelsChecked} channels
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border ${
                        r.updatesFound > 0
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                          : 'bg-white/5 text-slate-500 border-white/10'
                      }`}>
                        {r.updatesFound > 0 ? `${r.updatesFound} updates` : 'no updates'}
                      </span>
                      {r.errorCount > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 flex items-center gap-1"
                          title={r.errorChannels?.join(', ')}
                        >
                          {Icon.warn('w-3 h-3')} {r.errorCount} error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Check Logs ---------- */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div
          onClick={() => setShowLogs(v => !v)}
          className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {Icon.history('w-4 h-4 text-slate-400')} Check Logs (Diagnostic)
            {logs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-medium">
                {logs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {logs.length > 0 && (
              <button
                onClick={clearAllLogs}
                disabled={clearingLogs}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {clearingLogs ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                Clear Logs
              </button>
            )}
          </div>
        </div>

        {showLogs && (
          <div className="p-4">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Abhi tak koi check log nahi hai. "Check Now" ya "Test Run" dabao.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {logs.map((log: any) => {
                  const totalEntries = log.titles.reduce((sum: number, t: any) => sum + t.entries.length, 0);
                  return (
                    <details key={log._id} className="bg-black/20 rounded-xl border border-white/5 overflow-hidden group">
                      <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition list-none">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 flex-shrink-0 transition-transform group-open:rotate-90">{Icon.chevronRight('w-3.5 h-3.5')}</span>
                          <span className="text-xs font-semibold text-white truncate">{log.channelName}</span>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">· {log.titles.length} title(s)</span>
                        </div>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{formatIST(log.runAt)}</span>
                      </summary>

                      <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                        <p className="text-[10px] text-slate-500">{log.totalRecentVideos} recent videos fetched</p>
                        {log.titles.map((t: any, i: number) => (
                          <div key={i} className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                            <p className="text-[11px] font-medium text-purple-300 mb-1">
                              "{t.keyword}" — {t.matchedVideoCount} matched
                            </p>
                            {t.entries.length === 0 ? (
                              <p className="text-[10px] text-slate-500">Koi video keyword se match nahi hua.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {t.entries.map((e: any, j: number) => {
                                  const styleMap: Record<string, string> = {
                                    'added': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                                    'replaced': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
                                    'already-known': 'bg-white/5 text-slate-500 border-white/10',
                                    'no-format-detected': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                                    'season-blocked': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                                    'limit-blocked': 'bg-red-500/10 text-red-300 border-red-500/20',
                                    'needs-approval': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
                                  };
                                  const labelMap: Record<string, string> = {
                                    'added': 'Added',
                                    'replaced': 'Replaced',
                                    'already-known': 'Already known',
                                    'no-format-detected': 'No format',
                                    'season-blocked': 'Season blocked',
                                    'limit-blocked': 'Limit blocked',
                                    'needs-approval': 'Approval pending',
                                  };
                                  return (
                                    <div key={j} className="flex items-start gap-2 text-[10px]">
                                      <span className={`px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${styleMap[e.action] || 'bg-white/5 text-slate-400 border-white/10'}`}>
                                        {labelMap[e.action] || e.action}
                                      </span>
                                      <span className="text-slate-500 truncate">
                                        Part {e.part ?? '—'}{e.isRange ? ' (range)' : ''} · <span className="text-slate-400">{e.videoTitle}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackListManager;