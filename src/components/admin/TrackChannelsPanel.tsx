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

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

/* ---------- 🆕 Hide scrollbar utility class ---------- */
const HIDE_SCROLLBAR = 'scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

/* ---------- 🆕 Custom Checkbox (dark theme, matches UI) ---------- */
const CustomCheckbox: React.FC<{
  checked: boolean;
  size?: 'sm' | 'md';
}> = ({ checked, size = 'md' }) => {
  const boxSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span
      className={`${boxSize} flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-150 ${
        checked
          ? 'bg-gradient-to-br from-sky-500 to-cyan-500 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
          : 'bg-white/5 border-white/25 hover:border-white/50'
      }`}
    >
      {checked && (
        <svg
          className={`${iconSize} text-white`}
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
const SearchableDropdown: React.FC<{
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
        className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer text-white text-sm min-h-[42px]"
        onClick={() => setOpen((o) => !o)}
      >
        {value?.thumbnail && (
          <img src={value.thumbnail} className="w-6 h-6 object-cover rounded flex-shrink-0" alt="" />
        )}
        <span className="flex-1 truncate">{value?.title || placeholder}</span>
        <span className="text-slate-400 flex-shrink-0">{Icon.chevron('w-3.5 h-3.5')}</span>
      </div>
      {open && (
        <div className={`absolute z-30 mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl max-h-52 overflow-y-auto shadow-xl ${HIDE_SCROLLBAR}`}>
          <input
            type="text"
            autoFocus
            placeholder="Search anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-800/60 border-b border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">No anime found</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt._id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-white"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt.thumbnail ? (
                  <img src={opt.thumbnail} className="w-8 h-8 object-cover rounded flex-shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
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

/* ---------- ✅ Item 9 helper — sequential low-risk detection ---------- */
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

/* ---------- Props ---------- */
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
  // ✅ 🆕 Promise-returning so we can show loading feedback
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
  runPreview: (channelId: string, depth?: number) => void;
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

  /* ---------- 🆕 Local pending-action tracker (fixes double-click / no feedback) ---------- */
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  /**
   * Wrap any action with instant visual feedback:
   *  - Sets pendingAction → button shows spinner + disables
   *  - Waits for the parent's Promise to resolve
   *  - Clears pendingAction
   *  - If the action throws, we still clear it (parent already toasts errors)
   */
  const runAction = async (key: string, fn: () => void | Promise<void>) => {
    if (pendingRef.current) return; // guard against double-click
    pendingRef.current = key;
    setPendingAction(key);
    try {
      await fn();
    } catch {
      // Parent already shows its own error toast; swallow here
    } finally {
      // small delay so the animation feels intentional even on fast networks
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

  const NotifCard = ({ n, showChannelTag }: { n: TrackNotification; showChannelTag: boolean }) => (
    <div
      key={n._id}
      className={`rounded-xl border p-3 ${
        n.isRead ? 'bg-black/10 border-white/5 opacity-60' : 'bg-black/30 border-white/10'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          {n.oldThumbnail && (
            <div className="text-center">
              <img
                src={n.oldThumbnail}
                className="w-20 h-12 object-cover rounded-lg border border-white/10 opacity-60 cursor-zoom-in hover:opacity-90 transition"
                onClick={() => n.oldVideoId && setEnlargedVideoId(n.oldVideoId)}
              />
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold">Old · Part {n.oldPart ?? '?'}</p>
            </div>
          )}
          {n.oldThumbnail && <div className="text-slate-500 flex-shrink-0">→</div>}
          {n.newThumbnail && (
            <div className="text-center">
              <img
                src={n.newThumbnail}
                className="w-20 h-12 object-cover rounded-lg border border-emerald-500/40 cursor-zoom-in hover:opacity-90 transition"
                onClick={() => setEnlargedVideoId(n.newVideoId)}
              />
              <p className="text-[9px] text-emerald-400 mt-1 uppercase font-semibold">New · Part {n.newPart}</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full">
          <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5 flex-wrap">
            {n.titleKeyword || n.channelName}
            {n.notifType === 'needs_approval' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Approval Needed
              </span>
            )}
            {n.notifType === 'season_change' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Season Change
              </span>
            )}
            {n.notifType === 'limit_reached' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                Limit Reached
              </span>
            )}
            {n.notifType === 'manual_review' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/20">
                Manual Review
              </span>
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
                {Icon.share('w-3 h-3')} Share
              </button>
            )}
            {n.notifType === 'season_change' && !n.isRead && (
              <button
                onClick={() => resolveSeasonChange(n)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
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
                className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition flex items-center gap-1"
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
                className="text-[11px] px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition flex items-center gap-1 disabled:opacity-50"
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
                className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition"
              >
                View Channel
              </button>
            )}
            {!n.isRead && (
              <button
                onClick={() => markDone(n._id)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition sm:ml-auto flex items-center gap-1"
              >
                {Icon.check('w-3 h-3')} Mark as Done
              </button>
            )}
            {n.isRead && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-500 sm:ml-auto">Done</span>
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

  const renderBrowsePanel = (channelId: string, titleId: string) => {
    if (!(browsingTitle?.titleId === titleId && browsingTitle?.channelId === channelId)) return null;
    return (
      <div className="mt-2 bg-black/30 border border-white/10 rounded-xl overflow-hidden">
        {browseLoading ? (
          <div className="flex justify-center py-6">{Icon.spinner('w-5 h-5 text-slate-400')}</div>
        ) : browseData ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b border-white/10 bg-black/20">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white break-words">{browseData.keyword}</h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                  <span>{browseData.videos.length} video(s) · last known part: {browseData.lastKnownPart}</span>
                  {!browseData.initialized && (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      {Icon.clock('w-3 h-3')} Approval Pending
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={scanBrowseDeeper}
                  disabled={browseLoading}
                  className="text-[10px] px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center gap-1"
                >
                  {Icon.chevron('w-3 h-3')} Search Older
                </button>
                <button onClick={closeBrowseTitle} className="text-slate-400 hover:text-white p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2.5 bg-black/10 border-b border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SearchableDropdown
                  options={animeOptions}
                  value={animeOptions.find((a) => a._id === bulkAnimeId) || null}
                  onChange={(opt) => fetchBulkPages(opt?._id || '')}
                  placeholder="-- Select Anime --"
                />
                <select
                  value={bulkPageId}
                  onChange={(e) => setBulkPageId(e.target.value)}
                  disabled={!bulkAnimeId}
                  className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50 min-h-[42px]"
                >
                  <option value="">-- Select Page --</option>
                  {bulkPages.map((p: any, idx: number) => (
                    <option key={p._id} value={p._id}>
                      {pageLabel(idx)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllVideos}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition"
                  >
                    {browseData.videos?.every((v: any) => selectedVideoIds.has(v.videoId))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <span className="text-xs text-slate-400 font-medium">
                    {selectedVideoIds.size} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <button
                    onClick={bulkIgnoreSelected}
                    disabled={selectedVideoIds.size === 0 || bulkIgnoring}
                    className="px-3 py-2 sm:py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-[11px] rounded-lg font-semibold flex items-center justify-center gap-1"
                  >
                    {bulkIgnoring && Icon.spinner('w-3 h-3')} Ignore
                  </button>
                  <button
                    onClick={doBulkAdd}
                    disabled={!bulkPageId || selectedVideoIds.size === 0 || finalizing}
                    className="px-4 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-[11px] rounded-lg font-semibold flex items-center justify-center gap-1"
                  >
                    {finalizing && Icon.spinner('w-3 h-3')} Add Selected
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                <span className="mt-0.5 flex-shrink-0">{Icon.info('w-3 h-3')}</span>
                <span>
                  Wrong part number detected? Enter the correct number or range (like 1-50) in that video's
                  box — it will be added exactly like that.
                </span>
              </p>
            </div>

            <div className={`max-h-[340px] overflow-y-auto p-2 sm:p-3 space-y-2 ${HIDE_SCROLLBAR}`}>
              {browseData.videos.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No videos found.</p>
              ) : (
                browseData.videos.map((v: any) => {
                  const isSelected = selectedVideoIds.has(v.videoId);
                  return (
                    <div
                      key={v.videoId}
                      onClick={() => toggleVideoSelect(v.videoId)}
                      className={`rounded-xl p-2.5 border cursor-pointer transition ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-500/40 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                          : 'bg-black/20 hover:bg-black/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
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
                        <img
                          src={v.thumbnail}
                          className="w-16 h-9 object-cover rounded flex-shrink-0 cursor-zoom-in hover:opacity-80 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnlargedVideoId(v.videoId);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white line-clamp-2 leading-snug">{v.videoTitle}</p>
                          <p className="text-[9px] text-slate-500 mt-1">
                            {v.part !== null ? (
                              <span className={v.isRange ? 'text-sky-400' : 'text-emerald-400'}>
                                Part: {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                              </span>
                            ) : (
                              <span className="text-amber-400">Part not detected</span>
                            )}
                            {formatDuration(v.durationSec) && (
                              <span className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}>
                                {' '}· {formatDuration(v.durationSec)}
                              </span>
                            )}
                            {v.matchedFormat && ` · ${v.matchedFormat}`}
                          </p>

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
                              className="w-20 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-2 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                              }}
                              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white flex-shrink-0"
                            >
                              {expandedInfoId === v.videoId ? 'Less' : 'More'}
                            </button>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 hover:text-sky-300 flex-shrink-0 border border-sky-500/20"
                            >
                              Watch
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runAction(`ignore-${v.videoId}`, () => ignoreVideo(v.videoId));
                              }}
                              disabled={isPending(`ignore-${v.videoId}`)}
                              className="text-[10px] px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:text-red-300 flex-shrink-0 border border-red-500/20 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isPending(`ignore-${v.videoId}`) && Icon.spinner('w-2.5 h-2.5')}
                              Ignore
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedInfoId === v.videoId && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 pl-2 sm:pl-8">
                          <p className="text-slate-500 mb-1.5">{formatIST(v.publishedAt)}</p>
                          <p className="whitespace-pre-wrap max-h-40 overflow-y-auto">
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
              <div className="p-3 border-t border-white/10 bg-amber-500/5">
                {isSequentialLowRisk(browseData.videos) && bulkPageId && (
                  <button
                    onClick={quickApproveSequential}
                    disabled={finalizing}
                    className="w-full mb-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    {finalizing && Icon.spinner('w-3.5 h-3.5')}
                    ⚡ Quick Approve (Sequential Order)
                  </button>
                )}
                <p className="text-[10px] text-amber-300 mb-2 leading-relaxed">
                  After adding all episodes, press "Approve & Finalize" to start auto-tracking.
                </p>
                <button
                  onClick={finalizeApproval}
                  disabled={finalizing}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
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

  const renderChannelDetail = (ch: TrackedChannel) => {
    const q = searchQuery.trim().toLowerCase();
    const visibleTitles = q
      ? (ch.titles || []).filter((t) => t.keyword.toLowerCase().includes(q))
      : ch.titles;

    return (
    <div className="border-t border-white/10 bg-black/20 p-3 sm:p-4 space-y-4 sm:space-y-5">
      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => runAction(`pause-${ch._id}`, () => togglePause(ch._id))}
          disabled={!!togglingPause[ch._id] || isPending(`pause-${ch._id}`)}
          className={`flex-1 sm:flex-none min-w-[100px] px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1.5 ${
            ch.paused
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
          } disabled:opacity-50`}
        >
          {togglingPause[ch._id] || isPending(`pause-${ch._id}`) ? Icon.spinner('w-3.5 h-3.5') : ch.paused ? Icon.play('w-3.5 h-3.5') : Icon.pause('w-3.5 h-3.5')}
          {ch.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => runAction(`check-${ch._id}`, () => checkNow(ch._id))}
          disabled={checkingNow[ch._id] || isPending(`check-${ch._id}`)}
          className="flex-1 sm:flex-none min-w-[100px] px-3 py-2 text-xs rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {checkingNow[ch._id] || isPending(`check-${ch._id}`) ? Icon.spinner('w-3.5 h-3.5') : Icon.play('w-3.5 h-3.5')}
          Check Now
        </button>
        <button
          onClick={() => runAction(`refresh-${ch._id}`, () => refreshChannelInfo(ch._id))}
          disabled={!!refreshingInfo[ch._id] || isPending(`refresh-${ch._id}`)}
          className="flex-1 sm:flex-none min-w-[90px] px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {refreshingInfo[ch._id] || isPending(`refresh-${ch._id}`) ? Icon.spinner('w-3.5 h-3.5') : Icon.refresh('w-3.5 h-3.5')}
          Refresh
        </button>
        <button
          onClick={() => setShowChannelFeed((prev) => ({ ...prev, [ch._id]: !prev[ch._id] }))}
          className={`flex-1 sm:flex-none min-w-[80px] px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1.5 ${
            showChannelFeed[ch._id]
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
          }`}
        >
          {Icon.bell('w-3.5 h-3.5')} Feed
        </button>
        <button
          onClick={() => removeChannel(ch._id, ch.channelName)}
          className="w-full sm:w-auto sm:ml-auto px-3 py-2 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center justify-center gap-1.5"
        >
          {Icon.trash('w-3.5 h-3.5')} Remove
        </button>
      </div>

      {/* Tracked Titles */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3" id={`titles-${ch._id}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            {Icon.eye('w-3.5 h-3.5 text-sky-400')} Tracked Titles
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium normal-case">
              {ch.titles.length}{q ? ` · ${visibleTitles.length} matched` : ''}
            </span>
          </h4>
          <button
            onClick={() => setBulkModeChannel(bulkModeChannel === ch._id ? null : ch._id)}
            className="text-[11px] text-slate-400 hover:text-white transition self-start sm:self-auto px-2 py-1 rounded-lg hover:bg-white/5"
          >
            {bulkModeChannel === ch._id ? '← Single Add' : 'Bulk Add →'}
          </button>
        </div>

        {bulkModeChannel === ch._id ? (
          <div className="mb-3 space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Write one series name per line, like:\nNaruto\nOne Piece\nBleach'}
              rows={5}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed"
            />
            <button
              onClick={() => runAction(`bulk-${ch._id}`, () => addBulkTitles(ch._id, bulkText))}
              disabled={isPending(`bulk-${ch._id}`) || !bulkText.trim()}
              className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 border border-sky-500/50 text-xs font-semibold text-white rounded-lg transition flex items-center justify-center gap-1.5"
            >
              {isPending(`bulk-${ch._id}`) ? Icon.spinner('w-3.5 h-3.5') : Icon.plus('w-3.5 h-3.5')}
              {isPending(`bulk-${ch._id}`) ? 'Adding...' : 'Add All Titles'}
            </button>
          </div>
        ) : (
          <div className="mb-3 space-y-2.5">
            {/* Row 1: Title input */}
            <input
              value={titleInputs[ch._id] || ''}
              onChange={(e) => {
                setTitleInputs({ ...titleInputs, [ch._id]: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  runAction(`add-title-${ch._id}`, () =>
                    addTitle(ch._id, titleInputs[ch._id] || '', (excludeKeywordsInputs[ch._id] || '').split(',').map(s => s.trim()).filter(Boolean))
                  );
                }
              }}
              disabled={isPending(`add-title-${ch._id}`)}
              placeholder="Series name (e.g. 'Naruto')"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-60"
            />

            {/* Row 2: depth + preview + add */}
            <div className="flex gap-2">
              <select
                value={previewScanDepth}
                onChange={(e) => setPreviewScanDepth(Number(e.target.value))}
                title="How many recent videos to scan"
                className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
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
                onClick={() => {
                  setPreviewForChannel(ch._id);
                  runPreview(ch._id);
                }}
                disabled={previewLoading || !titleInputs[ch._id]?.trim()}
                className="flex-1 px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs font-medium text-sky-300 rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Preview which videos currently match this keyword before adding"
              >
                {previewLoading && previewForChannel === ch._id ? Icon.spinner('w-3.5 h-3.5') : Icon.search('w-3.5 h-3.5')}
                Preview
              </button>
              <button
                onClick={() => runAction(`add-title-${ch._id}`, () =>
                  addTitle(ch._id, titleInputs[ch._id] || '', (excludeKeywordsInputs[ch._id] || '').split(',').map(s => s.trim()).filter(Boolean))
                )}
                disabled={isPending(`add-title-${ch._id}`) || !titleInputs[ch._id]?.trim()}
                className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-500 border border-sky-500/50 text-xs font-semibold text-white rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
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

            {/* Row 3: Match slider */}
            <div className="bg-black/20 rounded-lg px-3 py-2 flex items-center gap-3">
              <label className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
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
              <span className="text-[11px] text-sky-400 font-bold tabular-nums w-9 text-right">
                {Math.round((matchThresholdInputs[ch._id] ?? 0.7) * 100)}%
              </span>
            </div>

            {/* Row 4: Exclude input */}
            <input
              value={excludeKeywordsInputs[ch._id] || ''}
              onChange={(e) => setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [ch._id]: e.target.value })}
              placeholder="Exclude keywords (comma separated)"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />

            {/* Row 5: Quick exclude chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickExcludes.map((word) => (
                <button
                  key={word}
                  onClick={() => addToExclude(ch._id, word)}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/5 hover:bg-sky-500/15 border border-white/10 hover:border-sky-500/30 text-slate-300 hover:text-sky-300 transition"
                >
                  + {word}
                </button>
              ))}
            </div>

            {previewForChannel === ch._id && previewResults && (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-2.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5">
                  <span className="text-[11px] text-sky-300 font-semibold">
                    {previewResults.matchedCount} video(s) matched
                  </span>
                  <button
                    onClick={() => scanPreviewDeeper(ch._id)}
                    disabled={previewLoading}
                    className="text-[10px] px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {Icon.chevron('w-3 h-3')} {previewLoading ? 'Scanning...' : 'Search Older'}
                  </button>
                </div>

                {previewResults.videos.length === 0 ? (
                  <p className="text-[11px] text-amber-400 px-1">No videos matched — try making the keyword broader.</p>
                ) : (
                  <>
                    <div className="bg-black/20 rounded-lg p-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <SearchableDropdown
                          options={animeOptions}
                          value={animeOptions.find((a) => a._id === previewBulkAnimeId) || null}
                          onChange={(opt) => fetchPreviewBulkPages(opt?._id || '')}
                          placeholder="-- Search Anime --"
                        />
                        <select
                          value={previewBulkPageId}
                          onChange={(e) => setPreviewBulkPageId(e.target.value)}
                          disabled={!previewBulkAnimeId}
                          className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 text-[11px] text-white disabled:opacity-50 min-h-[42px]"
                        >
                          <option value="">-- Select Page --</option>
                          {previewBulkPages.map((p: any, idx: number) => (
                            <option key={p._id} value={p._id}>
                              {pageLabel(idx)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAllPreviewVideos}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition"
                          >
                            {previewResults.videos.every((v) => previewSelectedIds.has(v.videoId))
                              ? 'Deselect All'
                              : 'Select All'}
                          </button>
                          <span className="text-[11px] text-slate-400 font-medium">{previewSelectedIds.size} selected</span>
                        </div>
                        <button
                          onClick={() => doPreviewBulkAdd(ch._id)}
                          disabled={!previewBulkPageId || previewSelectedIds.size === 0 || previewAdding}
                          className="px-3 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-[11px] rounded-lg font-semibold flex items-center justify-center gap-1"
                        >
                          {previewAdding && Icon.spinner('w-3 h-3')} Add Selected
                        </button>
                      </div>
                    </div>

                    <div className={`max-h-[340px] overflow-y-auto space-y-2 ${HIDE_SCROLLBAR}`}>
                      {previewResults.videos.map((v) => {
                        const isSelected = previewSelectedIds.has(v.videoId);
                        return (
                          <div
                            key={v.videoId}
                            onClick={() => togglePreviewVideoSelect(v.videoId)}
                            className={`rounded-xl p-2.5 border cursor-pointer transition ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500/40 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                                : 'bg-black/20 hover:bg-black/30 border-transparent'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
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
                              <img
                                src={v.thumbnail}
                                className="w-14 h-8 object-cover rounded flex-shrink-0 cursor-zoom-in hover:opacity-80 transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEnlargedVideoId(v.videoId);
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white line-clamp-2 leading-snug">{v.videoTitle}</p>
                                <p className="text-[9px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                  {v.part !== null ? (
                                    <span className={v.isRange ? 'text-sky-400' : 'text-emerald-400'}>
                                      Part: {v.isRange ? `${v.rangeStart}-${v.part}` : v.part}
                                    </span>
                                  ) : (
                                    <span className="text-amber-400">Part not detected</span>
                                  )}
                                  {formatDuration(v.durationSec) && (
                                    <span className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}>
                                      · {formatDuration(v.durationSec)}
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder={v.part !== null ? String(v.part) : 'Ep #'}
                                    value={previewEpisodeOverrides[v.videoId] ?? ''}
                                    onChange={(e) =>
                                      setPreviewEpisodeOverrides((prev) => ({ ...prev, [v.videoId]: e.target.value }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    title="Single episode number, or write like '1-50' for a range"
                                    className="w-16 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-2 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                                    }}
                                    className="text-[9px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex-shrink-0 flex items-center gap-0.5"
                                  >
                                    {expandedInfoId === v.videoId ? 'Less' : 'More'} {Icon.chevron('w-2.5 h-2.5')}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {expandedInfoId === v.videoId && (
                              <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300">
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
          {visibleTitles.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">
              {q ? 'No title matched this search.' : 'No title is being tracked right now.'}
            </p>
          )}
          {visibleTitles.map((t) => {
            const anyT = t as any;
            const daysSinceLast =
              anyT.lastKnownPublishedAt
                ? Math.floor((Date.now() - new Date(anyT.lastKnownPublishedAt).getTime()) / 86400000)
                : 0;
            const isRemoving = isPending(`remove-title-${t.id}`);
            const isSavingEdit = isPending(`save-edit-${t.id}`);
            const isUnlinking = isPending(`unlink-${t.id}`);
            const isSyncingPage = isPending(`sync-page-${t.id}`) || !!syncingPage[t.id];
            const isSyncingEp = isPending(`sync-ep-${t.id}`) || !!syncingEpStatus[t.id];

            return editingTitle === t.id ? (
              <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-black/30 rounded-xl p-3 border border-white/10">
                <input
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                  placeholder="Series name"
                  disabled={isSavingEdit}
                  className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white w-full sm:w-48 disabled:opacity-60"
                />
                <input
                  value={editLastPart}
                  onChange={(e) => setEditLastPart(e.target.value)}
                  placeholder="Last part"
                  type="number"
                  disabled={isSavingEdit}
                  className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white w-full sm:w-24 disabled:opacity-60"
                />
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => runAction(`save-edit-${t.id}`, () => saveEditTitle(ch._id, t.id, editKeyword, Number(editLastPart) || 0))}
                    disabled={isSavingEdit}
                    className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 disabled:opacity-60"
                  >
                    {isSavingEdit ? Icon.spinner('w-3.5 h-3.5') : Icon.check('w-3.5 h-3.5')}
                    {isSavingEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditTitle}
                    disabled={isSavingEdit}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={t.id}
                ref={(el) => { titleCardRefs.current[t.id] = el; }}
                className={`bg-black/20 rounded-xl p-3 border border-white/5 hover:border-white/15 transition ${isRemoving ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white break-words leading-snug" title={t.keyword}>
                      {t.keyword}
                    </p>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium">
                        Part {t.lastKnownPart}
                      </span>
                      {anyT.initialized === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                          {Icon.clock('w-2.5 h-2.5')} Pending
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                          {Icon.check('w-2.5 h-2.5')} Auto
                        </span>
                      )}
                      {daysSinceLast >= 14 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 border border-slate-500/30 font-medium flex items-center gap-1">
                          {Icon.clock('w-2.5 h-2.5')} {daysSinceLast}d ago
                        </span>
                      )}
                      {anyT.strictChronology && (
                        anyT.chronologyFloorDate || anyT.lastKnownPublishedAt ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center gap-1">
                            {Icon.clock('w-2.5 h-2.5')} {new Date(anyT.chronologyFloorDate || anyT.lastKnownPublishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-medium flex items-center gap-1">
                            {Icon.warn('w-2.5 h-2.5')} No floor
                          </span>
                        )
                      )}
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
                      className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition disabled:opacity-40"
                      title="Edit title"
                    >
                      {Icon.edit('w-3.5 h-3.5')}
                    </button>
                    <button
                      onClick={() => runAction(`remove-title-${t.id}`, () => removeTitle(ch._id, t.id))}
                      disabled={isRemoving}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-40"
                      title="Remove title"
                    >
                      {isRemoving ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>

                {/* Linked anime card */}
                {anyT.linkedDownloadPageId && (() => {
                  const linkedAnime = animeOptions.find((a) => a._id === anyT.linkedAnimeId);
                  return (
                    <div className="mt-2.5 flex items-center gap-2.5 bg-sky-500/[0.06] border border-sky-500/20 rounded-lg px-2.5 py-2">
                      {linkedAnime?.thumbnail ? (
                        <img
                          src={linkedAnime.thumbnail}
                          className="w-8 h-11 object-cover rounded-md flex-shrink-0 ring-1 ring-white/10"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-11 rounded-md bg-slate-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                          <span className="text-slate-600">{Icon.file('w-3.5 h-3.5')}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-sky-100 truncate" title={linkedAnime?.title}>
                          {linkedAnime?.title || 'Linked Anime'}
                        </p>
                        <p className="text-[9px] text-sky-300/70 mt-0.5 font-medium">
                          {anyT.episodeLimit ? `Limit ${anyT.episodeLimit} eps` : 'Unlimited episodes'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons row */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <button
                    onClick={() => openBrowseTitle(ch._id, t.id, t.keyword)}
                    disabled={isRemoving}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center gap-1 disabled:opacity-40"
                  >
                    {Icon.eye('w-3 h-3')} Episodes
                  </button>

                  {!anyT.linkedDownloadPageId ? (
                    <button
                      onClick={() => openLinkForm(t)}
                      disabled={isRemoving}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 transition flex items-center gap-1 disabled:opacity-40"
                    >
                      {Icon.plus('w-2.5 h-2.5')} Link Page
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => openLinkForm(t)}
                        disabled={isRemoving}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 transition disabled:opacity-40"
                      >
                        Edit Link
                      </button>
                      <button
                        onClick={() =>
                          runAction(`sync-page-${t.id}`, async () => {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-with-page`,
                              {},
                              { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
                            );
                            if (data.success) {
                              toast.success(`Synced — now last known part: ${data.syncedToPart}`);
                            } else {
                              toast.error(data.error || 'Sync failed');
                            }
                          })
                        }
                        disabled={isSyncingPage}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSyncingPage && Icon.spinner('w-3 h-3')} {isSyncingPage ? 'Syncing...' : 'Sync'}
                      </button>
                      <button
                        onClick={() =>
                          runAction(`sync-ep-${t.id}`, async () => {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-episode-status`,
                              {},
                              { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
                            );
                            if (data.success) {
                              toast.success(`Ep Status updated — Current: ${data.currentEpisode}`);
                            } else {
                              toast.error(data.error || 'Ep Status update failed');
                            }
                          })
                        }
                        disabled={isSyncingEp}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSyncingEp && Icon.spinner('w-3 h-3')} {isSyncingEp ? 'Updating...' : 'Update Ep'}
                      </button>
                      <button
                        onClick={() => runAction(`unlink-${t.id}`, () => unlinkTitle(ch._id, t.id))}
                        disabled={isUnlinking}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {isUnlinking && Icon.spinner('w-3 h-3')} {isUnlinking ? 'Unlinking...' : 'Unlink'}
                      </button>
                    </>
                  )}
                </div>

                {linkFormTitleId === t.id && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="p-3 bg-black/40 border border-white/20 rounded-xl space-y-2.5">
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

                      <select
                        value={linkPageId}
                        onChange={(e) => setLinkPageId(e.target.value)}
                        disabled={!linkAnimeId}
                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white disabled:opacity-50 min-h-[42px]"
                      >
                        <option value="">-- Select Download Page --</option>
                        {pagesForAnime.map((p, idx) => (
                          <option key={p._id} value={p._id}>
                            {pageLabel(idx)} ({(p.links || []).filter((l: any) => l.type === 'watch').length} watch)
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          value={linkLimit}
                          onChange={(e) => setLinkLimit(e.target.value)}
                          placeholder="Episode limit (0 = unlimited)"
                          className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="number"
                          min="1"
                          value={linkBaselineMin}
                          onChange={(e) => setLinkBaselineMin(e.target.value)}
                          placeholder="Minutes per episode (optional)"
                          className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        If no number is found in title/description, it will guess from duration and give you a review notification.
                      </p>

                      <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer bg-black/20 rounded-lg p-2.5">
                        <input
                          type="checkbox"
                          checked={linkMergeMode}
                          onChange={(e) => setLinkMergeMode(e.target.checked)}
                          className="mt-0.5 flex-shrink-0 accent-sky-500 w-4 h-4"
                        />
                        <span className="leading-relaxed">
                          <span className="font-medium">Compilation Merge Mode</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Auto-replace old link for range videos like 1-2 → 1-5
                          </span>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer bg-black/20 rounded-lg p-2.5">
                        <input
                          type="checkbox"
                          checked={linkStrictChronology}
                          onChange={(e) => setLinkStrictChronology(e.target.checked)}
                          className="mt-0.5 flex-shrink-0 accent-sky-500 w-4 h-4"
                        />
                        <span className="leading-relaxed">
                          <span className="font-medium">Strict Chronology Mode</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Only sequential next episodes will be auto-added
                          </span>
                        </span>
                      </label>
                      {linkStrictChronology && (
                        <div className="space-y-2 pl-1">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">
                              Manual Floor Date (optional — leave blank to use last known video date)
                            </label>
                            <input
                              type="date"
                              value={linkChronologyFloorDate}
                              onChange={(e) => setLinkChronologyFloorDate(e.target.value)}
                              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">
                              Grace Gap (0 = only exact next part)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={linkChronologyGraceGap}
                              onChange={(e) => setLinkChronologyGraceGap(e.target.value)}
                              placeholder="0"
                              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            Sequential next episode after floor date will be auto-added. Large gaps go to manual review.
                            Videos before floor date are always ignored.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => runAction(`save-link-${t.id}`, () => saveLinkForm(ch._id))}
                          disabled={savingLink || !linkPageId || isPending(`save-link-${t.id}`)}
                          className="flex-1 px-3 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
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
                          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium rounded-lg disabled:opacity-60"
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
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3">
          <div className="flex flex-col gap-2.5 mb-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              {Icon.bell('w-3.5 h-3.5 text-emerald-400')} Channel Feed
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => markAllDoneInList(pendingChannelNotifs)}
                className="text-[11px] px-2 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 transition flex items-center justify-center gap-1"
              >
                {Icon.checkAll('w-3.5 h-3.5')} <span className="hidden sm:inline">Mark Done</span><span className="sm:hidden">Done</span>
              </button>
              <button
                onClick={() => deleteAllInList(pendingChannelNotifs)}
                className="text-[11px] px-2 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center justify-center gap-1"
              >
                {Icon.trash('w-3.5 h-3.5')} <span className="hidden sm:inline">Remove All</span><span className="sm:hidden">Remove</span>
              </button>
              <button
                onClick={() => setShowAllUpdates((v) => !v)}
                className="text-[11px] px-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
              >
                {showAllUpdates ? 'Only Pending' : 'Show All'}
              </button>
            </div>
          </div>

          {pendingChannelNotifs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No updates for this channel right now</p>
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
        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          {Icon.eye('w-4 h-4 text-sky-400')} Tracked Channels
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium">
            {filteredChannels.length}/{channels.length}
          </span>
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          {!isSubAdmin && (
            <select
              value={addedByFilter}
              onChange={(e) => setAddedByFilter(e.target.value)}
              title="Filter by which admin added the channel"
              className="flex-1 sm:flex-none bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 min-h-[40px]"
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
            {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2')}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find channel or title..."
              className="w-full sm:w-56 bg-gray-800/60 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 min-h-[40px]"
            />
          </div>
        </div>
      </div>

      {/* Add Channel */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2">
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
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-60"
          />
          <button
            onClick={() => runAction('add-channel', () => addChannel())}
            disabled={adding || isPending('add-channel') || !newHandle.trim()}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            {adding || isPending('add-channel') ? Icon.spinner('w-4 h-4') : Icon.plus('w-4 h-4')}
            {adding || isPending('add-channel') ? 'Adding...' : 'Add Channel'}
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
          <p className="text-slate-500 text-sm">No channel is being tracked</p>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
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
        <div className="space-y-2">
          {filteredChannels.map((ch) => {
            const unread = unreadCountFor(ch.channelId);
            const isOpen = selectedChannelId === ch._id;
            const q = searchQuery.trim().toLowerCase();

            const matchedTitles = q
              ? (ch.titles || []).filter((t) => t.keyword.toLowerCase().includes(q))
              : [];
            const channelNameMatch = q ? (ch.channelName.toLowerCase().includes(q) || ch.channelHandle?.toLowerCase().includes(q)) : false;
            const primaryName = (q && matchedTitles.length > 0 && !channelNameMatch)
              ? matchedTitles[0].keyword
              : ch.channelName;
            const subtitle = (q && matchedTitles.length > 0 && !channelNameMatch)
              ? ch.channelName
              : undefined;

            return (
              <div
                key={ch._id}
                className={`bg-slate-800/30 backdrop-blur-xl border rounded-2xl overflow-hidden transition-colors ${
                  isOpen ? 'border-white/25 bg-white/[0.04]' : 'border-white/10'
                }`}
              >
                <button
                  onClick={() => setSelectedChannelId(isOpen ? null : ch._id)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition ${
                    isOpen ? '' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center overflow-hidden">
                      {ch.channelThumbnail ? (
                        <img src={ch.channelThumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm text-slate-400 font-bold">
                          {ch.channelName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">
                        {unread}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm truncate leading-snug" title={primaryName}>
                      {primaryName}
                      {matchedTitles.length > 1 && !channelNameMatch ? ` +${matchedTitles.length - 1} more` : ''}
                    </p>
                    {subtitle && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={subtitle}>
                        {subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20 font-medium">
                        {ch.titles.length} titles
                      </span>
                      {!isSubAdmin && ch.createdByUsername && ch.createdBy !== 'admin' && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium flex items-center gap-1"
                          title={`Added by sub-admin "${ch.createdByUsername}"`}
                        >
                          🏛️ {ch.createdByUsername}
                        </span>
                      )}
                      {ch.paused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-medium flex items-center gap-1">
                          {Icon.pause('w-2.5 h-2.5')} Paused
                        </span>
                      )}
                      {!!ch.consecutiveErrors && ch.consecutiveErrors > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-medium flex items-center gap-1">
                          {Icon.warn('w-2.5 h-2.5')} {ch.consecutiveErrors} error
                          {ch.consecutiveErrors > 1 ? 's' : ''}
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
  );
};

export default TrackChannelsPanel;