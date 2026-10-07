// src/components/admin/TrackChannelsPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  TrackedChannel,
  TrackedTitle,
  AnimeOption,
  PageOption,
  Capacity,
  TrackNotification,
  PreviewVideo,
} from '../../types/trackTypes';
import { Icon, formatDuration, pageLabel, formatIST } from '../../utils/trackUtils';
import { getAdminToken } from '../../../utils/authToken';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

/* ---------- Hide scrollbar utility class ---------- */
const HIDE_SCROLLBAR = 'scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

/* ---------- Custom Checkbox (dark theme, matches UI) ---------- */
const CustomCheckbox: React.FC<{
  checked: boolean;
  size?: 'sm' | 'md';
}> = ({ checked, size = 'md' }) => {
  const boxSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span
      className={`${boxSize} flex-shrink-0 rounded-[6px] border flex items-center justify-center transition-all duration-150 ${
        checked
          ? 'bg-gradient-to-br from-sky-400 to-cyan-500 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.55)]'
          : 'bg-white/[0.04] border-white/25 hover:border-white/60'
      }`}
    >
      {checked && (
        <svg
          className={`${iconSize} text-white drop-shadow`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
};

/* ---------- Searchable Dropdown ---------- */
export const SearchableDropdown: React.FC<{
  options: AnimeOption[];
  value: AnimeOption | null;
  onChange: (option: AnimeOption | null) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder = 'Search...' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) =>
    opt.title.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        className={`bg-slate-900/70 border rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer text-white text-sm min-h-[44px] transition ${
          open ? 'border-sky-500/50 ring-2 ring-sky-500/20' : 'border-white/10 hover:border-white/25'
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        {value?.thumbnail && (
          <img src={value.thumbnail} className="w-6 h-6 object-cover rounded-md flex-shrink-0 ring-1 ring-white/10" alt="" />
        )}
        <span className={`flex-1 truncate ${value ? 'text-white' : 'text-slate-500'}`}>
          {value?.title || placeholder}
        </span>
        <span className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          {Icon.chevron('w-3.5 h-3.5')}
        </span>
      </div>
      {open && (
        <div className={`absolute z-30 mt-1.5 w-full bg-slate-900 border border-white/15 rounded-xl max-h-64 overflow-y-auto shadow-2xl shadow-black/60 backdrop-blur-xl ${HIDE_SCROLLBAR}`}>
          <div className="p-2 border-b border-white/10 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
            <input
              type="text"
              autoFocus
              placeholder="Search anime..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-slate-500 text-center">No anime found</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt._id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-sky-500/10 cursor-pointer text-sm text-white transition"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt.thumbnail ? (
                  <img src={opt.thumbnail} className="w-8 h-8 object-cover rounded-md flex-shrink-0 ring-1 ring-white/10" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-white/5 rounded-md flex items-center justify-center text-xs text-slate-500 flex-shrink-0">
                    N/A
                  </div>
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

/* ---------- Depth Picker ---------- */
const DEPTH_PRESETS = [50, 100, 250, 500, 1000, 1500, 3000, 5000, 7500, 10000];
const MAX_DEPTH = 10000;
const fmtDepth = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));

const DepthPicker: React.FC<{
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyCustom = () => {
    const n = Math.floor(Number(custom));
    if (!n || n < 1) return;
    onChange(Math.min(MAX_DEPTH, n));
    setCustom('');
    setOpen(false);
  };

  const isCustom = !DEPTH_PRESETS.includes(value);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="How many recent videos to scan"
        className={`h-full min-h-[44px] px-3 bg-gradient-to-b from-white/[0.06] to-white/[0.02] border rounded-xl text-xs text-white flex items-center gap-2 transition disabled:opacity-60 ${
          open ? 'border-sky-500/60 ring-2 ring-sky-500/20' : 'border-white/10 hover:border-white/25'
        }`}
      >
        <span className="text-slate-500 font-medium">Depth</span>
        <span className="font-bold tabular-nums text-sky-300">{value.toLocaleString('en-IN')}</span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          {Icon.chevron('w-3 h-3')}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 w-72 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl shadow-black/60 p-4 space-y-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Scan depth · recent videos
            </p>
            {isCustom && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                Custom
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {DEPTH_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className={`py-2 rounded-lg text-[11px] font-bold border transition ${
                  value === d
                    ? 'bg-gradient-to-br from-sky-500 to-cyan-500 border-sky-400 text-white shadow-lg shadow-sky-500/30'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/25'
                }`}
              >
                {fmtDepth(d)}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              max={MAX_DEPTH}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCustom();
              }}
              placeholder="Custom (max 10000)"
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <button
              type="button"
              onClick={applyCustom}
              disabled={!custom}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition"
            >
              Set
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Bada depth chunks mein scan hota hai, progress bar dikhega.
          </p>
        </div>
      )}
    </div>
  );
};

/* ---------- Page Dropdown ---------- */
type PageDropdownOption = { value: string; label: string; hint?: string };

const toPageOptions = (pages: any[]): PageDropdownOption[] =>
  (pages || []).map((p: any, idx: number) => ({
    value: p._id,
    label: pageLabel(idx),
    hint: `${(p.links || []).filter((l: any) => l.type === 'watch').length} watch`,
  }));

const PageDropdown: React.FC<{
  options: PageDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ options, value, onChange, placeholder = '-- Select Page --', disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-slate-900/70 border rounded-xl px-3 py-2 flex items-center gap-2 text-left text-sm min-h-[44px] transition ${
          open ? 'border-sky-500/50 ring-2 ring-sky-500/20' : 'border-white/10 hover:border-white/25'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="text-slate-500 flex-shrink-0">{Icon.file('w-3.5 h-3.5')}</span>
        <span className={`flex-1 truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
          {selected?.label || placeholder}
        </span>
        {selected?.hint && (
          <span className="text-[10px] text-slate-500 flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
            {selected.hint}
          </span>
        )}
        <span className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          {Icon.chevron('w-3.5 h-3.5')}
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1.5 w-full bg-slate-900 border border-white/15 rounded-xl max-h-56 overflow-y-auto shadow-2xl shadow-black/60 backdrop-blur-xl py-1 ${HIDE_SCROLLBAR}`}
        >
          {options.length === 0 ? (
            <div className="px-3 py-6 text-sm text-slate-500 text-center">No pages found</div>
          ) : (
            options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition ${
                    isSel ? 'bg-sky-500/15 text-sky-200' : 'text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-[10px] text-slate-500 flex-shrink-0">{o.hint}</span>}
                  {isSel && <span className="text-sky-400 flex-shrink-0">{Icon.check('w-3.5 h-3.5')}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- Sequential low-risk helper ---------- */
function isSequentialLowRiskLocal(videos: any[]): boolean {
  const parts = Array.from(
    new Set(videos.filter((v: any) => v.part !== null).map((v: any) => v.part))
  ).sort((a: any, b: any) => a - b);
  if (parts.length < 2) return false;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] !== parts[i - 1] + 1) return false;
  }
  return true;
}

/* ---------- Props (unchanged) ---------- */
interface TrackChannelsPanelProps {
  channels: TrackedChannel[];
  capacity: Capacity;
  selectedChannelId: string | null;
  setSelectedChannelId: (id: string | null) => void;
  notifications: TrackNotification[];
  animeOptions: AnimeOption[];
  pagesForAnime: PageOption[];
  fetchPagesForAnime: (animeId: string) => void;
  addChannel: () => void | Promise<void>;
  removeChannel: (channelId: string, channelName: string) => void;
  refreshChannelInfo: (channelId: string) => void | Promise<void>;
  togglePause: (channelId: string) => void | Promise<void>;
  checkNow: (channelId: string) => void | Promise<void>;
  addTitle: (channelId: string, keyword: string, excludeKeywords: string[]) => void | Promise<void>;
  addBulkTitles: (channelId: string, bulkText: string) => void | Promise<void>;
  removeTitle: (channelId: string, titleId: string) => void | Promise<void>;
  saveEditTitle: (channelId: string, titleId: string, keyword: string, lastPart: number) => void | Promise<void>;
  openLinkForm: (t: TrackedTitle) => void;
  closeLinkForm: () => void;
  saveLinkForm: (channelId: string) => void | Promise<void>;
  unlinkTitle: (channelId: string, titleId: string) => void | Promise<void>;
  openBrowseTitle: (channelId: string, titleId: string, keyword: string, depth?: number) => void;
  closeBrowseTitle: () => void;
  newHandle: string;
  setNewHandle: (v: string) => void;
  adding: boolean;
  checkingNow: Record<string, boolean>;
  togglingPause: Record<string, boolean>;
  refreshingInfo: Record<string, boolean>;
  syncingPage: Record<string, boolean>;
  syncingEpStatus: Record<string, boolean>;
  showChannelFeed: Record<string, boolean>;
  setShowChannelFeed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  markAllDoneInList: (list: TrackNotification[]) => void;
  deleteAllInList: (list: TrackNotification[]) => void;
  showAllUpdates: boolean;
  setShowAllUpdates: React.Dispatch<React.SetStateAction<boolean>>;
  markDone: (id: string) => void;
  deleteNotification: (id: string) => void;
  shareVideo: (url: string) => void;
  resolveSeasonChange: (notif: TrackNotification) => void;
  undoNotification: (n: TrackNotification) => void;
  undoing: Record<string, boolean>;
  setNotificationDeleteConfirm: (v: any) => void;
  setEnlargedVideoId: (videoId: string | null) => void;
  browsingTitle: { channelId: string; titleId: string; keyword: string } | null;
  browseData: any;
  browseLoading: boolean;
  selectedVideoIds: Set<string>;
  episodeOverrides: Record<string, string>;
  setEpisodeOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toggleVideoSelect: (videoId: string) => void;
  selectAllVideos: () => void;
  doBulkAdd: () => void;
  bulkIgnoreSelected: () => void;
  finalizeApproval: () => void;
  ignoreVideo: (videoId: string) => void | Promise<void>;
  expandedInfoId: string | null;
  setExpandedInfoId: React.Dispatch<React.SetStateAction<string | null>>;
  scanBrowseDeeper: () => void;
  setBulkAnimeId: (id: string) => void;
  setBulkPageId: (id: string) => void;
  fetchBulkPages: (animeId: string) => void;
  bulkAnimeId: string;
  bulkPageId: string;
  bulkPages: any[];
  finalizing: boolean;
  bulkIgnoring: boolean;
  previewForChannel: string | null;
  setPreviewForChannel: (id: string | null) => void;
  previewLoading: boolean;
  previewResults: { matchedCount: number; videos: PreviewVideo[] } | null;
  previewSelectedIds: Set<string>;
  togglePreviewVideoSelect: (videoId: string) => void;
  selectAllPreviewVideos: () => void;
  previewEpisodeOverrides: Record<string, string>;
  setPreviewEpisodeOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  previewBulkAnimeId: string;
  setPreviewBulkAnimeId: (id: string) => void;
  previewBulkPageId: string;
  setPreviewBulkPageId: (id: string) => void;
  previewBulkPages: any[];
  fetchPreviewBulkPages: (animeId: string) => void;
  doPreviewBulkAdd: (channelId: string) => void;
  previewAdding: boolean;
  scanPreviewDeeper: (channelId: string) => void;
  runPreview: (channelId: string, continueScan?: boolean) => void;
  previewProgress: { scanned: number; target: number } | null;
  cancelPreview: () => void;
  previewScanDepth: number;
  setPreviewScanDepth: (v: number) => void;
  titleInputs: Record<string, string>;
  setTitleInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  excludeKeywordsInputs: Record<string, string>;
  setExcludeKeywordsInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quickExcludes: string[];
  addToExclude: (channelId: string, word: string) => void;
  bulkModeChannel: string | null;
  setBulkModeChannel: (id: string | null) => void;
  bulkText: string;
  setBulkText: (v: string) => void;
  editingTitle: string | null;
  setEditingTitle: (id: string | null) => void;
  editKeyword: string;
  setEditKeyword: (v: string) => void;
  editLastPart: string;
  setEditLastPart: (v: string) => void;
  cancelEditTitle: () => void;
  linkFormTitleId: string | null;
  setLinkFormTitleId: (id: string | null) => void;
  linkAnimeId: string;
  setLinkAnimeId: (id: string) => void;
  linkPageId: string;
  setLinkPageId: (id: string) => void;
  linkLimit: string;
  setLinkLimit: (v: string) => void;
  linkMergeMode: boolean;
  setLinkMergeMode: (v: boolean) => void;
  linkBaselineMin: string;
  setLinkBaselineMin: (v: string) => void;
  savingLink: boolean;
  matchThresholdInputs: Record<string, number>;
  setMatchThresholdInputs: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  quickApproveSequential: () => void;
  isSequentialLowRisk: (videos: any[]) => boolean;
  linkStrictChronology: boolean;
  setLinkStrictChronology: (v: boolean) => void;
  linkChronologyFloorDate: string;
  setLinkChronologyFloorDate: (v: string) => void;
  linkChronologyGraceGap: string;
  setLinkChronologyGraceGap: (v: string) => void;
  isSubAdmin?: boolean;
}

const TrackChannelsPanel: React.FC<TrackChannelsPanelProps> = ({
  channels,
  selectedChannelId,
  setSelectedChannelId,
  notifications,
  animeOptions,
  pagesForAnime,
  fetchPagesForAnime,
  addChannel,
  removeChannel,
  refreshChannelInfo,
  togglePause,
  checkNow,
  addTitle,
  addBulkTitles,
  removeTitle,
  saveEditTitle,
  openLinkForm,
  closeLinkForm,
  saveLinkForm,
  unlinkTitle,
  openBrowseTitle,
  closeBrowseTitle,
  newHandle,
  setNewHandle,
  adding,
  checkingNow,
  togglingPause,
  refreshingInfo,
  syncingPage,
  syncingEpStatus,
  showChannelFeed,
  setShowChannelFeed,
  markAllDoneInList,
  deleteAllInList,
  showAllUpdates,
  setShowAllUpdates,
  markDone,
  deleteNotification,
  shareVideo,
  resolveSeasonChange,
  undoNotification,
  undoing,
  setNotificationDeleteConfirm,
  setEnlargedVideoId,
  browsingTitle,
  browseData,
  browseLoading,
  selectedVideoIds,
  episodeOverrides,
  setEpisodeOverrides,
  toggleVideoSelect,
  selectAllVideos,
  doBulkAdd,
  bulkIgnoreSelected,
  finalizeApproval,
  ignoreVideo,
  expandedInfoId,
  setExpandedInfoId,
  scanBrowseDeeper,
  setBulkAnimeId,
  setBulkPageId,
  fetchBulkPages,
  bulkAnimeId,
  bulkPageId,
  bulkPages,
  finalizing,
  bulkIgnoring,
  previewForChannel,
  setPreviewForChannel,
  previewLoading,
  previewResults,
  previewSelectedIds,
  togglePreviewVideoSelect,
  selectAllPreviewVideos,
  previewEpisodeOverrides,
  setPreviewEpisodeOverrides,
  previewBulkAnimeId,
  setPreviewBulkAnimeId,
  previewBulkPageId,
  setPreviewBulkPageId,
  previewBulkPages,
  fetchPreviewBulkPages,
  doPreviewBulkAdd,
  previewAdding,
  scanPreviewDeeper,
  runPreview,
  previewProgress,
  cancelPreview,
  previewScanDepth,
  setPreviewScanDepth,
  titleInputs,
  setTitleInputs,
  excludeKeywordsInputs,
  setExcludeKeywordsInputs,
  quickExcludes,
  addToExclude,
  bulkModeChannel,
  setBulkModeChannel,
  bulkText,
  setBulkText,
  editingTitle,
  setEditingTitle,
  editKeyword,
  setEditKeyword,
  editLastPart,
  setEditLastPart,
  cancelEditTitle,
  linkFormTitleId,
  linkAnimeId,
  setLinkAnimeId,
  linkPageId,
  setLinkPageId,
  linkLimit,
  setLinkLimit,
  linkMergeMode,
  setLinkMergeMode,
  linkBaselineMin,
  setLinkBaselineMin,
  savingLink,
  matchThresholdInputs,
  setMatchThresholdInputs,
  quickApproveSequential,
  isSequentialLowRisk,
  linkStrictChronology,
  setLinkStrictChronology,
  linkChronologyFloorDate,
  setLinkChronologyFloorDate,
  linkChronologyGraceGap,
  setLinkChronologyGraceGap,
  isSubAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addedByFilter, setAddedByFilter] = useState<string>('main');
  const titleCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const runAction = async (key: string, fn: () => void | Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = key;
    setPendingAction(key);
    try {
      await fn();
    } catch {
      // parent toasts
    } finally {
      setTimeout(() => {
        pendingRef.current = null;
        setPendingAction(null);
      }, 250);
    }
  };

  const isPending = (key: string) => pendingAction === key;

  const subAdminOwners = Array.from(
    new Map(
      channels
        .filter((ch) => ch.createdBy && ch.createdBy !== 'admin')
        .map((ch) => [ch.createdBy as string, ch.createdByUsername || (ch.createdBy as string)])
    ).entries()
  ).map(([id, username]) => ({ id, username }));

  const unreadCountFor = (channelId: string) =>
    notifications.filter((n) => n.channelId === channelId && !n.isRead).length;

  const filteredChannels = channels.filter((ch) => {
    if (!isSubAdmin) {
      if (addedByFilter === 'main' && ch.createdBy && ch.createdBy !== 'admin') return false;
      if (addedByFilter !== 'main' && addedByFilter !== 'all' && ch.createdBy !== addedByFilter) return false;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const channelMatch =
      ch.channelName.toLowerCase().includes(q) || ch.channelHandle?.toLowerCase().includes(q);
    const titleMatch = (ch.titles || []).some((t) => t.keyword.toLowerCase().includes(q));
    return channelMatch || titleMatch;
  });

  useEffect(() => {
    if (searchQuery.trim() && filteredChannels.length > 0) {
      const q = searchQuery.trim().toLowerCase();
      for (const ch of filteredChannels) {
        const matchedTitle = (ch.titles || []).find((t) => t.keyword.toLowerCase().includes(q));
        if (matchedTitle) {
          setSelectedChannelId(ch._id);
          setTimeout(() => {
            const el = titleCardRefs.current[matchedTitle.id];
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          break;
        }
      }
    }
  }, [searchQuery]);

  const channelNotifications = notifications.filter(
    (n) => n.channelId === (channels.find((c) => c._id === selectedChannelId)?.channelId)
  );
  const pendingChannelNotifs = showAllUpdates
    ? channelNotifications
    : channelNotifications.filter((n) => !n.isRead);

  /* ---------- Notification Card (purple accents) ---------- */
  const NotifCard = ({ n, showChannelTag }: { n: TrackNotification; showChannelTag: boolean }) => (
    <div
      key={n._id}
      className={`rounded-2xl border p-3.5 transition ${
        n.isRead
          ? 'bg-white/[0.02] border-white/5 opacity-60'
          : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-white/10 shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          {n.oldThumbnail && (
            <div className="text-center">
              <img
                src={n.oldThumbnail}
                className="w-20 h-12 object-cover rounded-lg border border-white/10 opacity-70 cursor-zoom-in hover:opacity-100 hover:scale-[1.03] transition"
                onClick={() => n.oldVideoId && setEnlargedVideoId(n.oldVideoId)}
              />
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                Old · Part {n.oldPart ?? '?'}
              </p>
            </div>
          )}
          {n.oldThumbnail && <div className="text-slate-600 flex-shrink-0">→</div>}
          {n.newThumbnail && (
            <div className="text-center">
              <img
                src={n.newThumbnail}
                className="w-20 h-12 object-cover rounded-lg border-2 border-purple-500/50 cursor-zoom-in hover:scale-[1.03] transition shadow-lg shadow-purple-500/25"
                onClick={() => setEnlargedVideoId(n.newVideoId)}
              />
              <p className="text-[9px] text-purple-300 mt-1 uppercase font-bold tracking-wider">
                New · Part {n.newPart}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full">
          <p className="text-xs font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
            {n.titleKeyword || n.channelName}
            {n.notifType === 'needs_approval' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                Approval Needed
              </span>
            )}
            {n.notifType === 'season_change' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Season Change
              </span>
            )}
            {n.notifType === 'limit_reached' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-semibold">
                Limit Reached
              </span>
            )}
            {n.notifType === 'manual_review' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/20 font-semibold">
                Manual Review
              </span>
            )}
            {n.notifType === 'auto_paused' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-600/40 flex items-center gap-1 font-semibold">
                {Icon.ban('w-2.5 h-2.5')} Auto-Paused
              </span>
            )}
            {n.autoAdded && !n.undone && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-semibold">
                {Icon.check('w-2.5 h-2.5')} Auto-Added
              </span>
            )}
            {n.undone && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1 font-semibold">
                {Icon.undo('w-2.5 h-2.5')} Undone
              </span>
            )}
          </p>
          {n.newVideoTitle && <p className="text-[11px] text-slate-400 truncate mt-1">{n.newVideoTitle}</p>}
          {showChannelTag && <p className="text-[10px] text-slate-600 mt-0.5">{n.channelName}</p>}
          <p className="text-[10px] text-slate-600 mt-0.5">{formatIST(n.createdAt)}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {n.newVideoUrl && (
              <a
                href={n.newVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition flex items-center gap-1.5 font-medium"
              >
                {Icon.play('w-3 h-3')} Watch
              </a>
            )}
            {n.newVideoUrl && (
              <button
                onClick={() => shareVideo(n.newVideoUrl)}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition flex items-center gap-1.5 font-medium"
              >
                {Icon.share('w-3 h-3')} Share
              </button>
            )}
            {n.notifType === 'season_change' && !n.isRead && (
              <button
                onClick={() => resolveSeasonChange(n)}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition flex items-center gap-1.5 font-medium"
              >
                {Icon.clapperboard('w-3 h-3')} New Season
              </button>
            )}
            {n.notifType === 'needs_approval' && !n.isRead && (
              <button
                onClick={() => {
                  const channel = channels.find((ch) =>
                    (ch.titles || []).some((t: any) => t.keyword === n.titleKeyword)
                  );
                  const title = channel?.titles.find((t: any) => t.keyword === n.titleKeyword) as any;
                  if (channel && title) openBrowseTitle(channel._id, title.id, title.keyword);
                }}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition flex items-center gap-1.5 font-medium"
              >
                {Icon.eye('w-3 h-3')} Approve
              </button>
            )}
            {n.autoAdded && !n.undone && n.linkedDownloadPageId && (
              <button
                onClick={() => {
                  setNotificationDeleteConfirm({
                    notificationId: `undo-${n._id}`,
                    title: n.titleKeyword || n.channelName,
                    isBulk: false,
                  });
                }}
                disabled={!!undoing[n._id]}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition flex items-center gap-1.5 disabled:opacity-50 font-medium"
              >
                {undoing[n._id] ? Icon.spinner('w-3 h-3') : Icon.undo('w-3 h-3')} Undo
              </button>
            )}
            {n.notifType === 'auto_paused' && (
              <button
                onClick={() => {
                  const channel = channels.find((ch) => ch.channelId === n.channelId);
                  if (channel) setSelectedChannelId(channel._id);
                }}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition font-medium"
              >
                View Channel
              </button>
            )}
            {!n.isRead && (
              <button
                onClick={() => markDone(n._id)}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition sm:ml-auto flex items-center gap-1.5 font-medium"
              >
                {Icon.check('w-3 h-3')} Done
              </button>
            )}
            {n.isRead && (
              <span className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 text-slate-500 sm:ml-auto">
                Done
              </span>
            )}
            <button
              onClick={() => deleteNotification(n._id)}
              className="text-[11px] p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-300 transition"
              title="Permanently Remove"
            >
              {Icon.trash('w-3 h-3')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ---------- Browse Panel ---------- */
  const renderBrowsePanel = (channelId: string, titleId: string) => {
    if (!(browsingTitle?.titleId === titleId && browsingTitle?.channelId === channelId)) return null;
    return (
      <div className="mt-3 bg-gradient-to-br from-black/40 to-black/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
        {browseLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <span className="text-sky-400">{Icon.spinner('w-6 h-6')}</span>
            <p className="text-xs text-slate-500 font-medium">Loading videos…</p>
          </div>
        ) : browseData ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-white/10 bg-black/30">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white break-words flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  {browseData.keyword}
                </h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-medium">
                    {browseData.videos.length} video(s)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-medium">
                    last part: {browseData.lastKnownPart}
                  </span>
                  {!browseData.initialized && (
                    <span className="text-amber-300 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                      {Icon.clock('w-3 h-3')} Approval Pending
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={scanBrowseDeeper}
                  disabled={browseLoading}
                  className="text-[10px] px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center gap-1 font-semibold transition"
                >
                  {Icon.chevron('w-3 h-3')} Search Older
                </button>
                <button
                  onClick={closeBrowseTitle}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3.5 space-y-3 bg-gradient-to-b from-black/20 to-transparent border-b border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SearchableDropdown
                  options={animeOptions}
                  value={animeOptions.find((a) => a._id === bulkAnimeId) || null}
                  onChange={(opt) => fetchBulkPages(opt?._id || '')}
                  placeholder="-- Select Anime --"
                />
                <PageDropdown
                  options={toPageOptions(bulkPages)}
                  value={bulkPageId}
                  onChange={setBulkPageId}
                  disabled={!bulkAnimeId}
                  placeholder="-- Select Page --"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={selectAllVideos}
                    className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition font-semibold border border-white/10"
                  >
                    {browseData.videos?.every((v: any) => selectedVideoIds.has(v.videoId))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <span className="text-xs text-slate-300 font-semibold tabular-nums">
                    {selectedVideoIds.size} <span className="text-slate-500 font-normal">selected</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <button
                    onClick={bulkIgnoreSelected}
                    disabled={selectedVideoIds.size === 0 || bulkIgnoring}
                    className="px-3.5 py-2 sm:py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-[11px] rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/20 transition"
                  >
                    {bulkIgnoring && Icon.spinner('w-3 h-3')} Ignore
                  </button>
                  <button
                    onClick={doBulkAdd}
                    disabled={!bulkPageId || selectedVideoIds.size === 0 || finalizing}
                    className="px-4 py-2 sm:py-1.5 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-40 text-white text-[11px] rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
                  >
                    {finalizing && Icon.spinner('w-3 h-3')} Add Selected
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed bg-black/20 rounded-lg p-2.5 border border-white/5">
                <span className="mt-0.5 flex-shrink-0 text-sky-400">{Icon.info('w-3.5 h-3.5')}</span>
                <span>
                  Wrong part number detected? Enter the correct number or range (like <span className="text-sky-300 font-semibold">1-50</span>) in
                  that video's box — it will be added exactly like that.
                </span>
              </p>
            </div>

            <div className={`max-h-[420px] overflow-y-auto p-2.5 space-y-2 ${HIDE_SCROLLBAR}`}>
              {browseData.videos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">No videos found.</p>
                </div>
              ) : (
                browseData.videos.map((v: any) => {
                  const isSelected = selectedVideoIds.has(v.videoId);
                  return (
                    <div
                      key={v.videoId}
                      onClick={() => toggleVideoSelect(v.videoId)}
                      className={`group rounded-xl p-2.5 border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-gradient-to-br from-sky-500/15 to-cyan-500/5 border-sky-500/50 shadow-lg shadow-sky-500/10'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleVideoSelect(v.videoId)}
                            className="block focus:outline-none"
                            aria-checked={isSelected}
                            role="checkbox"
                          >
                            <CustomCheckbox checked={isSelected} size="md" />
                          </button>
                        </div>
                        <div className="relative flex-shrink-0">
                          <img
                            src={v.thumbnail}
                            className="w-[72px] h-[42px] object-cover rounded-lg cursor-zoom-in group-hover:opacity-90 transition ring-1 ring-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnlargedVideoId(v.videoId);
                            }}
                          />
                          {formatDuration(v.durationSec) && (
                            <span className="absolute bottom-1 right-1 text-[9px] px-1 py-0.5 rounded bg-black/80 text-white font-semibold tabular-nums">
                              {formatDuration(v.durationSec)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white line-clamp-2 leading-snug font-medium">{v.videoTitle}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {v.part !== null ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  v.isRange
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                }`}
                              >
                                Part {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Part not detected
                              </span>
                            )}
                            {v.matchedFormat && (
                              <span className="text-[9px] text-slate-500 truncate">{v.matchedFormat}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={v.part !== null ? String(v.part) : 'Ep #'}
                              value={episodeOverrides[v.videoId] ?? ''}
                              onChange={(e) =>
                                setEpisodeOverrides((prev) => ({ ...prev, [v.videoId]: e.target.value }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              title="Single episode number, or write like '1-50' for a range"
                              className="w-20 flex-shrink-0 bg-black/50 border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                              }}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0 transition font-medium"
                            >
                              {expandedInfoId === v.videoId ? 'Less' : 'More'}
                            </button>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 hover:text-sky-300 hover:bg-sky-500/25 flex-shrink-0 border border-sky-500/20 transition font-medium"
                            >
                              Watch
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runAction(`ignore-${v.videoId}`, () => ignoreVideo(v.videoId));
                              }}
                              disabled={isPending(`ignore-${v.videoId}`)}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:text-red-300 hover:bg-red-500/25 flex-shrink-0 border border-red-500/20 disabled:opacity-50 flex items-center gap-1 transition font-medium"
                            >
                              {isPending(`ignore-${v.videoId}`) && Icon.spinner('w-2.5 h-2.5')}
                              Ignore
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedInfoId === v.videoId && (
                        <div className="mt-2.5 pt-2.5 border-t border-white/10 text-[10px] text-slate-300 pl-2 sm:pl-9">
                          <p className="text-slate-500 mb-1.5">{formatIST(v.publishedAt)}</p>
                          <p className="whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                            {v.description || 'No description available.'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!browseData.initialized && (
              <div className="p-3.5 border-t border-white/10 bg-gradient-to-b from-purple-500/[0.06] to-transparent">
                {isSequentialLowRisk(browseData.videos) && bulkPageId && (
                  <button
                    onClick={quickApproveSequential}
                    disabled={finalizing}
                    className="w-full mb-2.5 px-4 py-3 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/30 transition"
                  >
                    {finalizing && Icon.spinner('w-3.5 h-3.5')}
                    ⚡ Quick Approve (Sequential Order)
                  </button>
                )}
                <p className="text-[10px] text-amber-300/90 mb-2.5 leading-relaxed text-center">
                  After adding all episodes, press "Approve & Finalize" to start auto-tracking.
                </p>
                <button
                  onClick={finalizeApproval}
                  disabled={finalizing}
                  className="w-full px-4 py-3 bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transition"
                >
                  {finalizing ? (
                    <>
                      {Icon.spinner('w-3.5 h-3.5')} Finalizing...
                    </>
                  ) : (
                    <>
                      {Icon.checkAll('w-3.5 h-3.5')} Approve & Finalize
                    </>
                  )}
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

  /* ---------- Channel Detail ---------- */
  const renderChannelDetail = (ch: TrackedChannel) => {
    const q = searchQuery.trim().toLowerCase();
    const visibleTitles = q
      ? (ch.titles || []).filter((t) => t.keyword.toLowerCase().includes(q))
      : ch.titles;

    return (
      <div className="border-t border-white/10 bg-gradient-to-b from-black/20 to-transparent p-3.5 sm:p-5 space-y-4 sm:space-y-5">
        {/* Actions bar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runAction(`pause-${ch._id}`, () => togglePause(ch._id))}
            disabled={!!togglingPause[ch._id] || isPending(`pause-${ch._id}`)}
            className={`flex-1 sm:flex-none min-w-[100px] px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-2 ${
              ch.paused
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            } disabled:opacity-50`}
          >
            {togglingPause[ch._id] || isPending(`pause-${ch._id}`)
              ? Icon.spinner('w-3.5 h-3.5')
              : ch.paused
              ? Icon.play('w-3.5 h-3.5')
              : Icon.pause('w-3.5 h-3.5')}
            {ch.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => runAction(`check-${ch._id}`, () => checkNow(ch._id))}
            disabled={checkingNow[ch._id] || isPending(`check-${ch._id}`)}
            className="flex-1 sm:flex-none min-w-[100px] px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {checkingNow[ch._id] || isPending(`check-${ch._id}`)
              ? Icon.spinner('w-3.5 h-3.5')
              : Icon.play('w-3.5 h-3.5')}
            Check Now
          </button>
          <button
            onClick={() => runAction(`refresh-${ch._id}`, () => refreshChannelInfo(ch._id))}
            disabled={!!refreshingInfo[ch._id] || isPending(`refresh-${ch._id}`)}
            className="flex-1 sm:flex-none min-w-[90px] px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {refreshingInfo[ch._id] || isPending(`refresh-${ch._id}`)
              ? Icon.spinner('w-3.5 h-3.5')
              : Icon.refresh('w-3.5 h-3.5')}
            Refresh
          </button>
          <button
            onClick={() => setShowChannelFeed((prev) => ({ ...prev, [ch._id]: !prev[ch._id] }))}
            className={`flex-1 sm:flex-none min-w-[80px] px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-2 ${
              showChannelFeed[ch._id]
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
            }`}
          >
            {Icon.bell('w-3.5 h-3.5')} Feed
          </button>
          <button
            onClick={() => removeChannel(ch._id, ch.channelName)}
            className="w-full sm:w-auto sm:ml-auto px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center justify-center gap-2"
          >
            {Icon.trash('w-3.5 h-3.5')} Remove
          </button>
        </div>

        {/* Tracked Titles */}
        <div
          className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-2xl p-4"
          id={`titles-${ch._id}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/25">
                {Icon.eye('w-3.5 h-3.5 text-sky-400')}
              </span>
              Tracked Titles
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-bold normal-case tracking-normal tabular-nums">
                {ch.titles.length}
                {q ? ` · ${visibleTitles.length} matched` : ''}
              </span>
            </h4>
            <button
              onClick={() => setBulkModeChannel(bulkModeChannel === ch._id ? null : ch._id)}
              className="text-[11px] text-slate-400 hover:text-white transition self-start sm:self-auto px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 font-medium"
            >
              {bulkModeChannel === ch._id ? '← Single Add' : 'Bulk Add →'}
            </button>
          </div>

          {bulkModeChannel === ch._id ? (
            <div className="mb-4 space-y-2.5">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Write one series name per line, like:\nNaruto\nOne Piece\nBleach'}
                rows={6}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 leading-relaxed transition"
              />
              <button
                onClick={() => runAction(`bulk-${ch._id}`, () => addBulkTitles(ch._id, bulkText))}
                disabled={isPending(`bulk-${ch._id}`) || !bulkText.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 border border-sky-500/50 text-xs font-bold text-white rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
              >
                {isPending(`bulk-${ch._id}`) ? Icon.spinner('w-3.5 h-3.5') : Icon.plus('w-3.5 h-3.5')}
                {isPending(`bulk-${ch._id}`) ? 'Adding...' : 'Add All Titles'}
              </button>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              {/* Title input */}
              <input
                value={titleInputs[ch._id] || ''}
                onChange={(e) => {
                  setTitleInputs({ ...titleInputs, [ch._id]: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    runAction(`add-title-${ch._id}`, () =>
                      addTitle(
                        ch._id,
                        titleInputs[ch._id] || '',
                        (excludeKeywordsInputs[ch._id] || '').split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    );
                  }
                }}
                disabled={isPending(`add-title-${ch._id}`)}
                placeholder="Series name (e.g. 'Naruto')"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 disabled:opacity-60 transition"
              />

              {/* depth + preview + add */}
              <div className="flex gap-2 items-stretch">
                <DepthPicker value={previewScanDepth} onChange={setPreviewScanDepth} disabled={previewLoading} />
                <button
                  onClick={() => {
                    setPreviewForChannel(ch._id);
                    runPreview(ch._id);
                  }}
                  disabled={previewLoading || !titleInputs[ch._id]?.trim()}
                  className="flex-1 px-3.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-semibold text-sky-300 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Preview which videos currently match this keyword before adding"
                >
                  {previewLoading && previewForChannel === ch._id
                    ? Icon.spinner('w-3.5 h-3.5')
                    : Icon.search('w-3.5 h-3.5')}
                  Preview
                </button>
                <button
                  onClick={() =>
                    runAction(`add-title-${ch._id}`, () =>
                      addTitle(
                        ch._id,
                        titleInputs[ch._id] || '',
                        (excludeKeywordsInputs[ch._id] || '').split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    )
                  }
                  disabled={isPending(`add-title-${ch._id}`) || !titleInputs[ch._id]?.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 border border-sky-500/50 text-xs font-bold text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-500/20"
                >
                  {isPending(`add-title-${ch._id}`) ? (
                    <>
                      {Icon.spinner('w-3.5 h-3.5')} Adding...
                    </>
                  ) : (
                    <>
                      {Icon.plus('w-3.5 h-3.5')} Add
                    </>
                  )}
                </button>
              </div>

              {/* Preview progress */}
              {previewLoading && previewForChannel === ch._id && previewProgress && (
                <div className="bg-black/30 rounded-xl px-3.5 py-2.5 space-y-2 border border-sky-500/20">
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="font-medium">
                      Scanning…{' '}
                      <span className="text-sky-300 font-bold tabular-nums">
                        {previewProgress.scanned} / {previewProgress.target}
                      </span>
                    </span>
                    <button onClick={cancelPreview} className="text-red-300 hover:text-red-200 font-bold">
                      Stop
                    </button>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                      style={{ width: `${Math.min(100, (previewProgress.scanned / previewProgress.target) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Match slider */}
              <div className="bg-black/25 rounded-xl px-3.5 py-2.5 flex items-center gap-3 border border-white/5">
                <label className="text-[10px] text-slate-400 whitespace-nowrap font-bold uppercase tracking-wider">
                  Match
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={matchThresholdInputs[ch._id] ?? 0.7}
                  onChange={(e) =>
                    setMatchThresholdInputs((prev) => ({ ...prev, [ch._id]: Number(e.target.value) }))
                  }
                  className="flex-1 accent-sky-500"
                />
                <span className="text-[11px] text-sky-300 font-bold tabular-nums w-10 text-right">
                  {Math.round((matchThresholdInputs[ch._id] ?? 0.7) * 100)}%
                </span>
              </div>

              {/* Exclude input */}
              <input
                value={excludeKeywordsInputs[ch._id] || ''}
                onChange={(e) => setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [ch._id]: e.target.value })}
                placeholder="Exclude keywords (comma separated)"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition"
              />

              {/* Quick exclude chips */}
              <div className="flex flex-wrap gap-1.5">
                {quickExcludes.map((word) => (
                  <button
                    key={word}
                    onClick={() => addToExclude(ch._id, word)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-sky-500/15 border border-white/10 hover:border-sky-500/30 text-slate-300 hover:text-sky-300 transition font-medium"
                  >
                    + {word}
                  </button>
                ))}
              </div>

              {/* Preview results */}
              {previewForChannel === ch._id && previewResults && (
                <div className="bg-gradient-to-br from-sky-500/[0.08] to-transparent border border-sky-500/25 rounded-2xl p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <span className="text-[11px] text-sky-200 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                      {previewResults.matchedCount} video(s) matched
                    </span>
                    <button
                      onClick={() => scanPreviewDeeper(ch._id)}
                      disabled={previewLoading}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center justify-center gap-1 font-semibold transition"
                    >
                      {Icon.chevron('w-3 h-3')} {previewLoading ? 'Scanning...' : 'Search Older'}
                    </button>
                  </div>

                  {previewResults.videos.length === 0 ? (
                    <p className="text-[11px] text-amber-400 px-1 text-center py-2">
                      No videos matched — try making the keyword broader.
                    </p>
                  ) : (
                    <>
                      <div className="bg-black/30 rounded-xl p-2.5 space-y-2.5 border border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <SearchableDropdown
                            options={animeOptions}
                            value={animeOptions.find((a) => a._id === previewBulkAnimeId) || null}
                            onChange={(opt) => fetchPreviewBulkPages(opt?._id || '')}
                            placeholder="-- Search Anime --"
                          />
                          <PageDropdown
                            options={toPageOptions(previewBulkPages)}
                            value={previewBulkPageId}
                            onChange={setPreviewBulkPageId}
                            disabled={!previewBulkAnimeId}
                            placeholder="-- Select Page --"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={selectAllPreviewVideos}
                              className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition font-semibold border border-white/10"
                            >
                              {previewResults.videos.every((v) => previewSelectedIds.has(v.videoId))
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                            <span className="text-[11px] text-slate-300 font-semibold tabular-nums">
                              {previewSelectedIds.size} <span className="text-slate-500 font-normal">selected</span>
                            </span>
                          </div>
                          <button
                            onClick={() => doPreviewBulkAdd(ch._id)}
                            disabled={!previewBulkPageId || previewSelectedIds.size === 0 || previewAdding}
                            className="px-3.5 py-2 sm:py-1.5 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-40 text-white text-[11px] rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
                          >
                            {previewAdding && Icon.spinner('w-3 h-3')} Add Selected
                          </button>
                        </div>
                      </div>

                      <div className={`max-h-[380px] overflow-y-auto space-y-2 ${HIDE_SCROLLBAR}`}>
                        {previewResults.videos.map((v) => {
                          const isSelected = previewSelectedIds.has(v.videoId);
                          return (
                            <div
                              key={v.videoId}
                              onClick={() => togglePreviewVideoSelect(v.videoId)}
                              className={`group rounded-xl p-2.5 border cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? 'bg-gradient-to-br from-sky-500/15 to-cyan-500/5 border-sky-500/50 shadow-lg shadow-sky-500/10'
                                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/15'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => togglePreviewVideoSelect(v.videoId)}
                                    className="block focus:outline-none"
                                    aria-checked={isSelected}
                                    role="checkbox"
                                  >
                                    <CustomCheckbox checked={isSelected} size="sm" />
                                  </button>
                                </div>
                                <div className="relative flex-shrink-0">
                                  <img
                                    src={v.thumbnail}
                                    className="w-16 h-9 object-cover rounded-lg cursor-zoom-in group-hover:opacity-90 transition ring-1 ring-white/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEnlargedVideoId(v.videoId);
                                    }}
                                  />
                                  {formatDuration(v.durationSec) && (
                                    <span className="absolute bottom-1 right-1 text-[8px] px-1 py-0.5 rounded bg-black/80 text-white font-semibold tabular-nums">
                                      {formatDuration(v.durationSec)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-white line-clamp-2 leading-snug font-medium">
                                    {v.videoTitle}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {v.part !== null ? (
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                          v.isRange
                                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                        }`}
                                      >
                                        Part {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        Part not detected
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder={v.part !== null ? String(v.part) : 'Ep #'}
                                      value={previewEpisodeOverrides[v.videoId] ?? ''}
                                      onChange={(e) =>
                                        setPreviewEpisodeOverrides((prev) => ({
                                          ...prev,
                                          [v.videoId]: e.target.value,
                                        }))
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      title="Single episode number, or write like '1-50' for a range"
                                      className="w-16 flex-shrink-0 bg-black/50 border border-white/15 rounded-lg px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition"
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                                      }}
                                      className="text-[9px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex-shrink-0 flex items-center gap-0.5 transition font-medium"
                                    >
                                      {expandedInfoId === v.videoId ? 'Less' : 'More'}
                                      {Icon.chevron('w-2.5 h-2.5')}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {expandedInfoId === v.videoId && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/10 text-[10px] text-slate-300">
                                  <p className="text-slate-500 mb-1.5 flex items-center gap-2 flex-wrap">
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
                                  <p className="whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
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
          <div className="space-y-2.5">
            {visibleTitles.length === 0 && (
              <div className="text-center py-8 bg-black/20 rounded-xl border border-dashed border-white/10">
                <p className="text-xs text-slate-500">
                  {q ? 'No title matched this search.' : 'No title is being tracked right now.'}
                </p>
              </div>
            )}
            {visibleTitles.map((t) => {
              const anyT = t as any;
              const daysSinceLast = anyT.lastKnownPublishedAt
                ? Math.floor((Date.now() - new Date(anyT.lastKnownPublishedAt).getTime()) / 86400000)
                : 0;
              const isRemoving = isPending(`remove-title-${t.id}`);
              const isSavingEdit = isPending(`save-edit-${t.id}`);
              const isUnlinking = isPending(`unlink-${t.id}`);
              const isSyncingPage = isPending(`sync-page-${t.id}`) || !!syncingPage[t.id];
              const isSyncingEp = isPending(`sync-ep-${t.id}`) || !!syncingEpStatus[t.id];
              const isInitialized = anyT.initialized !== false;

              return editingTitle === t.id ? (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 bg-black/40 rounded-2xl p-3.5 border border-white/15"
                >
                  <input
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    placeholder="Series name"
                    disabled={isSavingEdit}
                    className="bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white w-full sm:w-48 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                  <input
                    value={editLastPart}
                    onChange={(e) => setEditLastPart(e.target.value)}
                    placeholder="Last part"
                    type="number"
                    disabled={isSavingEdit}
                    className="bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white w-full sm:w-24 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() =>
                        runAction(`save-edit-${t.id}`, () =>
                          saveEditTitle(ch._id, t.id, editKeyword, Number(editLastPart) || 0)
                        )
                      }
                      disabled={isSavingEdit}
                      className="px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white border border-purple-400/50 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 shadow-lg shadow-purple-500/25 transition"
                    >
                      {isSavingEdit ? Icon.spinner('w-3.5 h-3.5') : Icon.check('w-3.5 h-3.5')}
                      {isSavingEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditTitle}
                      disabled={isSavingEdit}
                      className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium disabled:opacity-60 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={t.id}
                  ref={(el) => {
                    titleCardRefs.current[t.id] = el;
                  }}
                  className={`relative bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl p-3.5 border transition-all duration-150 overflow-hidden ${
                    isRemoving ? 'opacity-50 pointer-events-none' : 'border-white/5 hover:border-white/15 hover:shadow-lg hover:shadow-black/20'
                  }`}
                >
                  {/* Left accent strip — purple */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      isInitialized
                        ? 'bg-gradient-to-b from-purple-400/70 to-fuchsia-500/30 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                        : 'bg-gradient-to-b from-amber-400/60 to-amber-500/20'
                    }`}
                  />

                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white break-words leading-snug" title={t.keyword}>
                        {t.keyword}
                      </p>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10 font-bold tabular-nums">
                          Part {t.lastKnownPart}
                        </span>
                        {anyT.initialized === false ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                            {Icon.clock('w-2.5 h-2.5')} Pending
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                            {Icon.check('w-2.5 h-2.5')} Auto
                          </span>
                        )}
                        {daysSinceLast >= 14 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 border border-slate-500/30 font-bold flex items-center gap-1">
                            {Icon.clock('w-2.5 h-2.5')} {daysSinceLast}d ago
                          </span>
                        )}
                        {anyT.strictChronology &&
                          (anyT.chronologyFloorDate || anyT.lastKnownPublishedAt ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1">
                              {Icon.clock('w-2.5 h-2.5')}{' '}
                              {new Date(
                                anyT.chronologyFloorDate || anyT.lastKnownPublishedAt
                              ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold flex items-center gap-1">
                              {Icon.warn('w-2.5 h-2.5')} No floor
                            </span>
                          ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingTitle(t.id);
                          setEditKeyword(t.keyword);
                          setEditLastPart(String(t.lastKnownPart));
                        }}
                        disabled={isRemoving}
                        className="p-2 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition disabled:opacity-40"
                        title="Edit title"
                      >
                        {Icon.edit('w-3.5 h-3.5')}
                      </button>
                      <button
                        onClick={() => runAction(`remove-title-${t.id}`, () => removeTitle(ch._id, t.id))}
                        disabled={isRemoving}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-40"
                        title="Remove title"
                      >
                        {isRemoving ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                      </button>
                    </div>
                  </div>

                  {/* Linked anime card */}
                  {anyT.linkedDownloadPageId &&
                    (() => {
                      const linkedAnime = animeOptions.find((a) => a._id === anyT.linkedAnimeId);
                      return (
                        <div className="mt-3 ml-2 flex items-center gap-3 bg-gradient-to-r from-sky-500/[0.08] to-transparent border border-sky-500/20 rounded-xl px-3 py-2.5">
                          {linkedAnime?.thumbnail ? (
                            <img
                              src={linkedAnime.thumbnail}
                              className="w-9 h-12 object-cover rounded-md flex-shrink-0 ring-1 ring-white/10 shadow-md"
                              alt=""
                            />
                          ) : (
                            <div className="w-9 h-12 rounded-md bg-slate-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                              <span className="text-slate-600">{Icon.file('w-3.5 h-3.5')}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-sky-100 truncate" title={linkedAnime?.title}>
                              {linkedAnime?.title || 'Linked Anime'}
                            </p>
                            <p className="text-[9px] text-sky-300/70 mt-0.5 font-medium">
                              {anyT.episodeLimit ? `Limit ${anyT.episodeLimit} eps` : 'Unlimited episodes'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Action row */}
                  <div className="flex items-center gap-1.5 mt-3 ml-2 flex-wrap">
                    <button
                      onClick={() => openBrowseTitle(ch._id, t.id, t.keyword)}
                      disabled={isRemoving}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center gap-1 disabled:opacity-40 font-semibold"
                    >
                      {Icon.eye('w-3 h-3')} Episodes
                    </button>

                    {!anyT.linkedDownloadPageId ? (
                      <button
                        onClick={() => openLinkForm(t)}
                        disabled={isRemoving}
                        className="text-[10px] px-3 py-1.5 rounded-lg bg-gradient-to-br from-sky-500/20 to-cyan-500/10 hover:from-sky-500/30 hover:to-cyan-500/20 border border-sky-500/30 text-sky-300 transition flex items-center gap-1 disabled:opacity-40 font-semibold"
                      >
                        {Icon.plus('w-2.5 h-2.5')} Link Page
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openLinkForm(t)}
                          disabled={isRemoving}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 transition disabled:opacity-40 font-semibold"
                        >
                          Edit Link
                        </button>
                        <button
                          onClick={() =>
                            runAction(`sync-page-${t.id}`, async () => {
                              const { data } = await axios.post(
                                `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-with-page`,
                                {},
                                { headers: { Authorization: `Bearer ${getAdminToken()}` } }
                              );
                              if (data.success) {
                                toast.success(`Synced — now last known part: ${data.syncedToPart}`);
                              } else {
                                toast.error(data.error || 'Sync failed');
                              }
                            })
                          }
                          disabled={isSyncingPage}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition disabled:opacity-50 flex items-center gap-1 font-semibold"
                        >
                          {isSyncingPage && Icon.spinner('w-3 h-3')} {isSyncingPage ? 'Syncing...' : 'Sync'}
                        </button>
                        <button
                          onClick={() =>
                            runAction(`sync-ep-${t.id}`, async () => {
                              const { data } = await axios.post(
                                `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-episode-status`,
                                {},
                                { headers: { Authorization: `Bearer ${getAdminToken()}` } }
                              );
                              if (data.success) {
                                toast.success(`Ep Status updated — Current: ${data.currentEpisode}`);
                              } else {
                                toast.error(data.error || 'Ep Status update failed');
                              }
                            })
                          }
                          disabled={isSyncingEp}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition disabled:opacity-50 flex items-center gap-1 font-semibold"
                        >
                          {isSyncingEp && Icon.spinner('w-3 h-3')} {isSyncingEp ? 'Updating...' : 'Update Ep'}
                        </button>
                        <button
                          onClick={() => runAction(`unlink-${t.id}`, () => unlinkTitle(ch._id, t.id))}
                          disabled={isUnlinking}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition disabled:opacity-50 flex items-center gap-1 font-semibold"
                        >
                          {isUnlinking && Icon.spinner('w-3 h-3')} {isUnlinking ? 'Unlinking...' : 'Unlink'}
                        </button>
                      </>
                    )}
                  </div>

                  {linkFormTitleId === t.id && (
                    <div className="mt-3.5 ml-2 pt-3.5 border-t border-white/10">
                      <div className="p-3.5 bg-black/50 border border-white/15 rounded-2xl space-y-3">
                        <SearchableDropdown
                          options={animeOptions}
                          value={animeOptions.find((a) => a._id === linkAnimeId) || null}
                          onChange={(opt) => {
                            setLinkAnimeId(opt?._id || '');
                            setLinkPageId('');
                            fetchPagesForAnime(opt?._id || '');
                          }}
                          placeholder="-- Select Anime --"
                        />

                        <PageDropdown
                          options={toPageOptions(pagesForAnime)}
                          value={linkPageId}
                          onChange={setLinkPageId}
                          disabled={!linkAnimeId}
                          placeholder="-- Select Download Page --"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            value={linkLimit}
                            onChange={(e) => setLinkLimit(e.target.value)}
                            placeholder="Episode limit (0 = unlimited)"
                            className="bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                          />
                          <input
                            type="number"
                            min="1"
                            value={linkBaselineMin}
                            onChange={(e) => setLinkBaselineMin(e.target.value)}
                            placeholder="Minutes per episode (optional)"
                            className="bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          If no number is found in title/description, it will guess from duration and give you a
                          review notification.
                        </p>

                        <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] rounded-xl p-3 border border-white/5 transition">
                          <input
                            type="checkbox"
                            checked={linkMergeMode}
                            onChange={(e) => setLinkMergeMode(e.target.checked)}
                            className="mt-0.5 flex-shrink-0 accent-sky-500 w-4 h-4"
                          />
                          <span className="leading-relaxed">
                            <span className="font-semibold text-white">Compilation Merge Mode</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Auto-replace old link for range videos like 1-2 → 1-5
                            </span>
                          </span>
                        </label>

                        <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] rounded-xl p-3 border border-white/5 transition">
                          <input
                            type="checkbox"
                            checked={linkStrictChronology}
                            onChange={(e) => setLinkStrictChronology(e.target.checked)}
                            className="mt-0.5 flex-shrink-0 accent-sky-500 w-4 h-4"
                          />
                          <span className="leading-relaxed">
                            <span className="font-semibold text-white">Strict Chronology Mode</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Only sequential next episodes will be auto-added
                            </span>
                          </span>
                        </label>
                        {linkStrictChronology && (
                          <div className="space-y-2.5 pl-1">
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1.5">
                                Manual Floor Date (optional — leave blank to use last known video date)
                              </label>
                              <input
                                type="date"
                                value={linkChronologyFloorDate}
                                onChange={(e) => setLinkChronologyFloorDate(e.target.value)}
                                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1.5">
                                Grace Gap (0 = only exact next part)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={linkChronologyGraceGap}
                                onChange={(e) => setLinkChronologyGraceGap(e.target.value)}
                                placeholder="0"
                                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Sequential next episode after floor date will be auto-added. Large gaps go to manual
                              review. Videos before floor date are always ignored.
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => runAction(`save-link-${t.id}`, () => saveLinkForm(ch._id))}
                            disabled={savingLink || !linkPageId || isPending(`save-link-${t.id}`)}
                            className="flex-1 px-3.5 py-3 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25"
                          >
                            {isPending(`save-link-${t.id}`) ? (
                              <>
                                {Icon.spinner('w-3.5 h-3.5')} Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={closeLinkForm}
                            disabled={isPending(`save-link-${t.id}`)}
                            className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium rounded-xl disabled:opacity-60 transition"
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

        {/* Channel Feed */}
        {showChannelFeed[ch._id] && (
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-2xl p-4">
            <div className="flex flex-col gap-3 mb-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/25">
                  {Icon.bell('w-3.5 h-3.5 text-purple-400')}
                </span>
                Channel Feed
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => markAllDoneInList(pendingChannelNotifs)}
                  className="text-[11px] px-2 py-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 transition flex items-center justify-center gap-1.5 font-semibold"
                >
                  {Icon.checkAll('w-3.5 h-3.5')}{' '}
                  <span className="hidden sm:inline">Mark Done</span>
                  <span className="sm:hidden">Done</span>
                </button>
                <button
                  onClick={() => deleteAllInList(pendingChannelNotifs)}
                  className="text-[11px] px-2 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center justify-center gap-1.5 font-semibold"
                >
                  {Icon.trash('w-3.5 h-3.5')}{' '}
                  <span className="hidden sm:inline">Remove All</span>
                  <span className="sm:hidden">Remove</span>
                </button>
                <button
                  onClick={() => setShowAllUpdates((v) => !v)}
                  className="text-[11px] px-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition font-semibold"
                >
                  {showAllUpdates ? 'Only Pending' : 'Show All'}
                </button>
              </div>
            </div>

            {pendingChannelNotifs.length === 0 ? (
              <div className="text-center py-10 bg-black/20 rounded-xl border border-dashed border-white/10">
                <p className="text-sm text-slate-500">No updates for this channel right now</p>
              </div>
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
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/10 border border-sky-500/25">
            {Icon.eye('w-4 h-4 text-sky-400')}
          </span>
          Tracked Channels
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10 font-bold tabular-nums">
            {filteredChannels.length}
            <span className="text-slate-500 font-normal"> / {channels.length}</span>
          </span>
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          {!isSubAdmin && (
            <select
              value={addedByFilter}
              onChange={(e) => setAddedByFilter(e.target.value)}
              title="Filter by which admin added the channel"
              className="flex-1 sm:flex-none bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 min-h-[42px] transition"
            >
              <option value="main">👑 Main Admin</option>
              <option value="all">🌐 Show All</option>
              {subAdminOwners.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  🏛️ {sa.username}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:flex-none">
            {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2')}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find channel or title..."
              className="w-full sm:w-64 bg-slate-900/70 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 min-h-[42px] transition"
            />
          </div>
        </div>
      </div>

      {/* Add Channel */}
      <div className="relative bg-gradient-to-br from-sky-500/[0.06] via-transparent to-cyan-500/[0.04] backdrop-blur-xl border border-sky-500/15 rounded-2xl p-4 overflow-hidden">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row gap-2.5">
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !adding && !isPending('add-channel')) {
                runAction('add-channel', () => addChannel());
              }
            }}
            disabled={adding || isPending('add-channel')}
            placeholder="Enter YouTube channel handle (e.g. @ChannelName)"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 disabled:opacity-60 transition"
          />
          <button
            onClick={() => runAction('add-channel', () => addChannel())}
            disabled={adding || isPending('add-channel') || !newHandle.trim()}
            className="px-6 py-3 bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 disabled:shadow-none text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 flex-shrink-0 shadow-lg shadow-sky-500/25"
          >
            {adding || isPending('add-channel') ? Icon.spinner('w-4 h-4') : Icon.plus('w-4 h-4')}
            {adding || isPending('add-channel') ? 'Adding...' : 'Add Channel'}
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-14 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl border border-dashed border-white/10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 mb-3">
            {Icon.youtube('w-6 h-6 text-sky-400')}
          </div>
          <p className="text-slate-400 text-sm font-medium">No channel is being tracked</p>
          <p className="text-slate-600 text-xs mt-1">Add your first YouTube channel above to get started</p>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="text-center py-14 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl border border-dashed border-white/10">
          <p className="text-slate-500 text-sm px-4">
            {searchQuery.trim()
              ? 'No channel found with this name'
              : !isSubAdmin && addedByFilter === 'main'
              ? 'Main admin hasn\'t added any channel yet. Select "Show All" from filter.'
              : !isSubAdmin && addedByFilter !== 'all'
              ? 'This sub-admin hasn\'t added any channel yet'
              : 'No channel found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredChannels.map((ch) => {
            const unread = unreadCountFor(ch.channelId);
            const isOpen = selectedChannelId === ch._id;
            const q = searchQuery.trim().toLowerCase();

            const matchedTitles = q
              ? (ch.titles || []).filter((t) => t.keyword.toLowerCase().includes(q))
              : [];
            const channelNameMatch = q
              ? ch.channelName.toLowerCase().includes(q) || ch.channelHandle?.toLowerCase().includes(q)
              : false;
            const primaryName =
              q && matchedTitles.length > 0 && !channelNameMatch ? matchedTitles[0].keyword : ch.channelName;
            const subtitle =
              q && matchedTitles.length > 0 && !channelNameMatch ? ch.channelName : undefined;

            return (
              <div
                key={ch._id}
                className={`relative bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isOpen
                    ? 'border-sky-500/30 shadow-xl shadow-sky-500/5 bg-sky-500/[0.03]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => setSelectedChannelId(isOpen ? null : ch._id)}
                  className="w-full flex items-center gap-3.5 p-3.5 text-left transition"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                      {ch.channelThumbnail ? (
                        <img src={ch.channelThumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm text-slate-300 font-bold">
                          {ch.channelName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {!ch.paused && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-purple-400 border-2 border-slate-900 shadow-[0_0_6px_rgba(192,132,252,0.7)]" />
                    )}
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900 shadow-lg shadow-rose-500/40 tabular-nums">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-sm truncate leading-snug" title={primaryName}>
                      {primaryName}
                      {matchedTitles.length > 1 && !channelNameMatch ? (
                        <span className="text-sky-400 font-medium"> +{matchedTitles.length - 1} more</span>
                      ) : (
                        ''
                      )}
                    </p>
                    {subtitle && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={subtitle}>
                        {subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20 font-bold tabular-nums">
                        {ch.titles.length} titles
                      </span>
                      {!isSubAdmin && ch.createdByUsername && ch.createdBy !== 'admin' && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold flex items-center gap-1"
                          title={`Added by sub-admin "${ch.createdByUsername}"`}
                        >
                          🏛️ {ch.createdByUsername}
                        </span>
                      )}
                      {ch.paused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-bold flex items-center gap-1">
                          {Icon.pause('w-2.5 h-2.5')} Paused
                        </span>
                      )}
                      {!!ch.consecutiveErrors && ch.consecutiveErrors > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-bold flex items-center gap-1">
                          {Icon.warn('w-2.5 h-2.5')} {ch.consecutiveErrors} error
                          {ch.consecutiveErrors > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-slate-400 flex-shrink-0 transition-transform duration-200 p-1.5 rounded-lg hover:bg-white/5 ${
                      isOpen ? 'rotate-180 text-sky-400' : ''
                    }`}
                  >
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
  );
};

export default TrackChannelsPanel;