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
        className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer text-white text-sm"
        onClick={() => setOpen((o) => !o)}
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
                  <img src={opt.thumbnail} className="w-8 h-8 object-cover rounded" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
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
  // channel actions
  addChannel: () => void;
  removeChannel: (channelId: string, channelName: string) => void;
  refreshChannelInfo: (channelId: string) => void;
  togglePause: (channelId: string) => void;
  checkNow: (channelId: string) => void;
  // title actions
  addTitle: (channelId: string, keyword: string, excludeKeywords: string[]) => void;
  addBulkTitles: (channelId: string, bulkText: string) => void;
  removeTitle: (channelId: string, titleId: string) => void;
  saveEditTitle: (channelId: string, titleId: string, keyword: string, lastPart: number) => void;
  openLinkForm: (t: TrackedTitle) => void;
  closeLinkForm: () => void;
  saveLinkForm: (channelId: string) => void;
  unlinkTitle: (channelId: string, titleId: string) => void;
  // browse
  openBrowseTitle: (channelId: string, titleId: string, keyword: string, depth?: number) => void;
  closeBrowseTitle: () => void;
  // extra
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
  // NotifCard needs
  markDone: (id: string) => void;
  deleteNotification: (id: string) => void;
  shareVideo: (url: string) => void;
  resolveSeasonChange: (notif: TrackNotification) => void;
  undoNotification: (n: TrackNotification) => void;
  undoing: Record<string, boolean>;
  setNotificationDeleteConfirm: (v: any) => void;
  setEnlargedVideoId: (videoId: string | null) => void;
  // extra browse state
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
  ignoreVideo: (videoId: string) => void;
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
  // preview states
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
  // bulk add state
  bulkModeChannel: string | null;
  setBulkModeChannel: (id: string | null) => void;
  bulkText: string;
  setBulkText: (v: string) => void;
  // edit title state
  editingTitle: string | null;
  setEditingTitle: (id: string | null) => void;
  editKeyword: string;
  setEditKeyword: (v: string) => void;
  editLastPart: string;
  setEditLastPart: (v: string) => void;
  cancelEditTitle: () => void;
  // link form state
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
  // ✅ Item 8 — match strictness
  matchThresholdInputs: Record<string, number>;
  setMatchThresholdInputs: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // ✅ Item 9 — quick approve
  quickApproveSequential: () => void;
  isSequentialLowRisk: (videos: any[]) => boolean;
  // 🆕 Strict Chronology Mode
  linkStrictChronology: boolean;
  setLinkStrictChronology: (v: boolean) => void;
  linkChronologyFloorDate: string;
  setLinkChronologyFloorDate: (v: string) => void;
  linkChronologyGraceGap: string;
  setLinkChronologyGraceGap: (v: string) => void;
  // 🆕 sub-admin detection
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
  const [addedByFilter, setAddedByFilter] = useState<string>('main'); // 🆕 'main' = default (sirf main admin ke channels)
  const titleCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 🆕 Channels se unique sub-admins nikalo (dropdown ke liye)
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
    // 🆕 Added-by filter — sirf super-admin dashboard mein apply hota hai
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

  // Auto-expand & scroll to first matching title when search query changes
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

  // shared NotifCard rendering
  const NotifCard = ({ n, showChannelTag }: { n: TrackNotification; showChannelTag: boolean }) => (
    <div
      key={n._id}
      className={`rounded-xl border p-3 ${
        n.isRead ? 'bg-black/10 border-white/5 opacity-60' : 'bg-black/30 border-white/10'
      }`}
    >
      <div className="flex items-start gap-3">
        {n.oldThumbnail && (
          <div className="flex-shrink-0 text-center">
            <img
              src={n.oldThumbnail}
              className="w-20 h-12 object-cover rounded-lg border border-white/10 opacity-60 cursor-zoom-in hover:opacity-90 transition"
              onClick={() => n.oldVideoId && setEnlargedVideoId(n.oldVideoId)}
            />
            <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold">Old · Part {n.oldPart ?? '?'}</p>
          </div>
        )}
        {n.oldThumbnail && <div className="flex-shrink-0 self-center text-slate-500">→</div>}
        {n.newThumbnail && (
          <div className="flex-shrink-0 text-center">
            <img
              src={n.newThumbnail}
              className="w-20 h-12 object-cover rounded-lg border border-emerald-500/40 cursor-zoom-in hover:opacity-90 transition"
              onClick={() => setEnlargedVideoId(n.newVideoId)}
            />
            <p className="text-[9px] text-emerald-400 mt-1 uppercase font-semibold">New · Part {n.newPart}</p>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5 flex-wrap">
            {n.titleKeyword || n.channelName}
            {n.notifType === 'needs_approval' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Approval Chahiye
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
                  const channel = channels.find((ch) =>
                    (ch.titles || []).some((t: any) => t.keyword === n.titleKeyword)
                  );
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

  // Browse Panel renderer
  const renderBrowsePanel = (channelId: string, titleId: string) => {
    if (!(browsingTitle?.titleId === titleId && browsingTitle?.channelId === channelId)) return null;
    return (
      <div className="mt-2 bg-black/30 border border-white/10 rounded-xl overflow-hidden">
        {browseLoading ? (
          <div className="flex justify-center py-6">{Icon.spinner('w-5 h-5 text-slate-400')}</div>
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
                    value={animeOptions.find((a) => a._id === bulkAnimeId) || null}
                    onChange={(opt) => fetchBulkPages(opt?._id || '')}
                    placeholder="-- Anime select karo --"
                  />
                </div>
                <select
                  value={bulkPageId}
                  onChange={(e) => setBulkPageId(e.target.value)}
                  disabled={!bulkAnimeId}
                  className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  <option value="">-- Page select karo --</option>
                  {bulkPages.map((p: any, idx: number) => (
                    <option key={p._id} value={p._id}>
                      {pageLabel(idx)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllVideos}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition"
                  >
                    {browseData.videos?.every((v: any) => selectedVideoIds.has(v.videoId))
                      ? 'Deselect All'
                      : 'Select All'}
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
                    disabled={!bulkPageId || selectedVideoIds.size === 0 || finalizing}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs rounded-lg font-semibold border border-white/10"
                  >
                    {finalizing && Icon.spinner('w-3 h-3')} Selected Ko Is Page Me Add Karo
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 flex items-start gap-1">
                <span className="mt-0.5">{Icon.info('w-3 h-3 flex-shrink-0')}</span>
                <span>
                  Agar system ne galat/koi part number detect nahi kiya, uss video ke "Ep # ya 1-50" box me sahi
                  number ya range daal do — waisa hi add hoga. Video card kahin bhi click karke bhi select/deselect ho
                  jayega.
                </span>
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
                        isSelected ? 'bg-white/10 border-white/30' : 'bg-black/20 hover:bg-black/30 border-white/5'
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
                        <img
                          src={v.thumbnail}
                          className="w-16 h-9 object-cover rounded flex-shrink-0 cursor-zoom-in hover:opacity-80 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnlargedVideoId(v.videoId);
                          }}
                        />
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
                              <span
                                className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}
                              >
                                {' '}
                                · {formatDuration(v.durationSec)}
                              </span>
                            )}
                            {v.matchedFormat && ` · ${v.matchedFormat}`}
                          </p>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={v.part !== null ? String(v.part) : 'Ep # ya 1-50'}
                          value={episodeOverrides[v.videoId] ?? ''}
                          onChange={(e) =>
                            setEpisodeOverrides((prev) => ({ ...prev, [v.videoId]: e.target.value }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          title="Single episode number, ya range ke liye '1-50' jaisa likho"
                          className="w-20 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-1.5 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                          }}
                          className="text-[10px] text-slate-400 hover:text-white flex-shrink-0"
                        >
                          {expandedInfoId === v.videoId ? 'Less' : 'More'}
                        </button>
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-sky-400 hover:text-sky-300 flex-shrink-0"
                        >
                          Watch
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            ignoreVideo(v.videoId);
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 flex-shrink-0"
                        >
                          Ignore
                        </button>
                      </div>

                      {expandedInfoId === v.videoId && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 pl-7">
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
                    className="w-full mb-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    ⚡ Quick Approve (Sequential Order Detected — sab episodes ek saath add + approve)
                  </button>
                )}
                <p className="text-[10px] text-amber-300 mb-2">
                  Sab episodes add karne ke baad "Approve & Finalize" dabao, fir auto-tracking chalu ho jayega.
                </p>
                <button
                  onClick={finalizeApproval}
                  disabled={finalizing}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  {finalizing ? (
                    'Finalizing...'
                  ) : (
                    <>
                      {Icon.checkAll('w-3.5 h-3.5')} Approve & Finalize (auto-tracking shuru ho)
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

  // Render channel detail (accordion body) — titles now filtered by search query
  const renderChannelDetail = (ch: TrackedChannel) => {
    const q = searchQuery.trim().toLowerCase();
    // If search query exists, filter titles to only those matching
    const visibleTitles = q
      ? (ch.titles || []).filter((t) => t.keyword.toLowerCase().includes(q))
      : ch.titles;

    return (
    <div className="border-t border-white/10 bg-black/20 p-4 space-y-5">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => togglePause(ch._id)}
          disabled={!!togglingPause[ch._id]}
          className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1.5 ${
            ch.paused
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
          } disabled:opacity-50`}
        >
          {togglingPause[ch._id] ? Icon.spinner('w-3.5 h-3.5') : ch.paused ? Icon.play('w-3.5 h-3.5') : Icon.pause('w-3.5 h-3.5')}
          {ch.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => checkNow(ch._id)}
          disabled={checkingNow[ch._id]}
          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {checkingNow[ch._id] ? Icon.spinner('w-3.5 h-3.5') : Icon.play('w-3.5 h-3.5')}
          Check Now
        </button>
        <button
          onClick={() => refreshChannelInfo(ch._id)}
          disabled={!!refreshingInfo[ch._id]}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {refreshingInfo[ch._id] ? Icon.spinner('w-3.5 h-3.5') : Icon.refresh('w-3.5 h-3.5')}
          Refresh Info
        </button>
        <button
          onClick={() => setShowChannelFeed((prev) => ({ ...prev, [ch._id]: !prev[ch._id] }))}
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

      {/* Tracked Titles */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3" id={`titles-${ch._id}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            {Icon.eye('w-3.5 h-3.5 text-sky-400')} Tracked Titles ({ch.titles.length}{q ? ` · ${visibleTitles.length} matched` : ''})
          </h4>
          <button
            onClick={() => setBulkModeChannel(bulkModeChannel === ch._id ? null : ch._id)}
            className="text-[11px] text-slate-300 hover:text-white transition"
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
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <button
              onClick={() => addBulkTitles(ch._id, bulkText)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1"
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
                }}
                onKeyDown={(e) => e.key === 'Enter' && addTitle(ch._id, titleInputs[ch._id] || '', (excludeKeywordsInputs[ch._id] || '').split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Naya series naam (jaise 'Naruto')"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <select
                value={previewScanDepth}
                onChange={(e) => setPreviewScanDepth(Number(e.target.value))}
                title="Kitne recent videos scan karne hain"
                className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20"
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
                disabled={previewLoading}
                className="px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs font-medium text-sky-300 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                title="Add karne se pehle preview karo ki abhi konse videos is keyword se match ho rahe hain"
              >
                {previewLoading && previewForChannel === ch._id ? Icon.spinner('w-3.5 h-3.5') : Icon.search('w-3.5 h-3.5')}
                Preview
              </button>
              <button
                onClick={() => addTitle(ch._id, titleInputs[ch._id] || '', (excludeKeywordsInputs[ch._id] || '').split(',').map(s => s.trim()).filter(Boolean))}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 rounded-lg transition flex items-center gap-1"
              >
                {Icon.plus('w-3.5 h-3.5')} Add
              </button>
            </div>

            {/* ✅ Item 8 — Match Strictness Slider */}
            <div className="flex items-center gap-2 px-1">
              <label className="text-[10px] text-slate-400 whitespace-nowrap w-28">
                Match Strictness: {Math.round((matchThresholdInputs[ch._id] ?? 0.7) * 100)}%
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
            </div>

            <input
              value={excludeKeywordsInputs[ch._id] || ''}
              onChange={(e) => setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [ch._id]: e.target.value })}
              placeholder="Exclude karo (comma se alag karo): Sub, English Dub, Tamil, Telugu"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            />

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

            {/* Preview results (inline) */}
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
                            value={animeOptions.find((a) => a._id === previewBulkAnimeId) || null}
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
                          {previewBulkPages.map((p: any, idx: number) => (
                            <option key={p._id} value={p._id}>
                              {pageLabel(idx)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAllPreviewVideos}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition"
                          >
                            {previewResults.videos.every((v) => previewSelectedIds.has(v.videoId))
                              ? 'Deselect All'
                              : 'Select All'}
                          </button>
                          <span className="text-[11px] text-slate-400">{previewSelectedIds.size} selected</span>
                        </div>
                        <button
                          onClick={() => doPreviewBulkAdd(ch._id)}
                          disabled={!previewBulkPageId || previewSelectedIds.size === 0 || previewAdding}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-[11px] rounded-lg font-semibold border border-white/10 flex items-center gap-1"
                        >
                          {previewAdding && Icon.spinner('w-3 h-3')} Selected Ko Is Page Me Add Karo
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto space-y-1.5">
                      {previewResults.videos.map((v) => {
                        const isSelected = previewSelectedIds.has(v.videoId);
                        return (
                          <div
                            key={v.videoId}
                            onClick={() => togglePreviewVideoSelect(v.videoId)}
                            className={`rounded-lg p-1.5 border cursor-pointer transition ${
                              isSelected
                                ? 'bg-white/10 border-white/30'
                                : 'bg-black/20 hover:bg-black/30 border-transparent'
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
                              <img
                                src={v.thumbnail}
                                className="w-12 h-7 object-cover rounded flex-shrink-0 cursor-zoom-in hover:opacity-80 transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEnlargedVideoId(v.videoId);
                                }}
                              />
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
                                    <span className={v.durationSec === 0 ? 'text-amber-400' : 'text-slate-400'}>
                                      · {formatDuration(v.durationSec)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={v.part !== null ? String(v.part) : 'Ep # ya 1-50'}
                                value={previewEpisodeOverrides[v.videoId] ?? ''}
                                onChange={(e) =>
                                  setPreviewEpisodeOverrides((prev) => ({ ...prev, [v.videoId]: e.target.value }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                title="Single episode number, ya range ke liye '1-50' jaisa likho"
                                className="w-16 flex-shrink-0 bg-gray-700/60 border border-gray-600/80 rounded-lg px-1 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedInfoId((prev) => (prev === v.videoId ? null : v.videoId));
                                }}
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

        {/* Title cards list — only visible titles */}
        <div className="space-y-2">
          {visibleTitles.length === 0 && (
            <p className="text-xs text-slate-500">
              {q ? 'Is search se koi title match nahi hua.' : 'Abhi koi title track nahi ho raha.'}
            </p>
          )}
          {visibleTitles.map((t) => {
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
                  onClick={() => saveEditTitle(ch._id, t.id, editKeyword, Number(editLastPart) || 0)}
                  className="text-emerald-400 hover:text-emerald-300 p-1"
                >
                  {Icon.check('w-3.5 h-3.5')}
                </button>
                <button onClick={cancelEditTitle} className="text-slate-400 hover:text-red-400 p-1">
                  {Icon.trash('w-3.5 h-3.5')}
                </button>
              </div>
            ) : (
              <div
                key={t.id}
                ref={(el) => { titleCardRefs.current[t.id] = el; }}
                className="bg-black/20 rounded-xl p-3 border border-white/5 hover:border-white/10 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white break-words" title={t.keyword}>
                        {t.keyword}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 flex-shrink-0">
                        last part: {t.lastKnownPart}
                      </span>
                      {anyT.initialized === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 flex-shrink-0">
                          {Icon.clock('w-2.5 h-2.5')} Approval Pending (Auto OFF)
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                          {Icon.check('w-2.5 h-2.5')} Auto-Tracking ON
                        </span>
                      )}
                      {anyT.lastKnownPublishedAt && (() => {
                        const days = Math.floor((Date.now() - new Date(anyT.lastKnownPublishedAt).getTime()) / 86400000);
                        if (days < 14) return null;
                        return (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 border border-slate-500/30 flex items-center gap-1 flex-shrink-0">
                            {Icon.clock('w-2.5 h-2.5')} {days} din se naya episode nahi
                          </span>
                        );
                      })()}
                      {anyT.strictChronology && (
                        anyT.chronologyFloorDate || anyT.lastKnownPublishedAt ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 flex-shrink-0">
                            {Icon.clock('w-2.5 h-2.5')} Floor: {new Date(anyT.chronologyFloorDate || anyT.lastKnownPublishedAt).toLocaleDateString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 flex-shrink-0">
                            {Icon.warn('w-2.5 h-2.5')} Floor date nahi mili — pehle ek video approve karo
                          </span>
                        )
                      )}
                    </div>

                    {anyT.linkedDownloadPageId && (() => {
                      const linkedAnime = animeOptions.find((a) => a._id === anyT.linkedAnimeId);
                      return (
                        <div className="mt-2 flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 transition-colors">
                          {linkedAnime?.thumbnail ? (
                            <img
                              src={linkedAnime.thumbnail}
                              className="w-9 h-12 object-cover rounded-lg flex-shrink-0 ring-1 ring-white/10"
                              alt=""
                            />
                          ) : (
                            <div className="w-9 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                              <span className="text-slate-600">{Icon.file('w-4 h-4')}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="flex-shrink-0 p-1 rounded-md bg-white/10 text-slate-300">
                                {Icon.link('w-2.5 h-2.5')}
                              </span>
                              <p className="text-[11px] font-semibold text-white/90 truncate" title={linkedAnime?.title}>
                                {linkedAnime?.title || 'Linked Anime'}
                              </p>
                            </div>
                            <span className="inline-flex items-center text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium">
                              {anyT.episodeLimit ? `Limit: ${anyT.episodeLimit} eps` : 'Unlimited episodes'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingTitle(t.id);
                        setEditKeyword(t.keyword);
                        setEditLastPart(String(t.lastKnownPart));
                      }}
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
                    {Icon.eye('w-3 h-3')} See all Episodes 
                  </button>

                  {!anyT.linkedDownloadPageId ? (
                    <button
                      onClick={() => openLinkForm(t)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition flex items-center gap-1"
                    >
                      {Icon.plus('w-2.5 h-2.5')} Page se link karo (auto-add )
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openLinkForm(t)}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 transition"
                      >
                        Edit Link
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-with-page`,
                              {},
                              { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
                            );
                            if (data.success) {
                              toast.success(`Sync ho gaya — ab last known part: ${data.syncedToPart}`);
                            } else {
                              toast.error(data.error || 'Sync fail ho gaya');
                            }
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || 'Sync fail ho gaya');
                          }
                        }}
                        disabled={!!syncingPage[t.id]}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {syncingPage[t.id] && Icon.spinner('w-3 h-3')} Page Se Sync
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await axios.post(
                              `${API_BASE}/track/channel/${ch._id}/title/${t.id}/sync-episode-status`,
                              {},
                              { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
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
                        disabled={!!syncingEpStatus[t.id]}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {syncingEpStatus[t.id] && Icon.spinner('w-3 h-3')} Ep Status Update
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
                    <div className="p-3 bg-black/40 border border-white/20 rounded-xl space-y-2 w-full">
                      <div>
                        <SearchableDropdown
                          options={animeOptions}
                          value={animeOptions.find((a) => a._id === linkAnimeId) || null}
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

                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={linkStrictChronology}
                          onChange={(e) => setLinkStrictChronology(e.target.checked)}
                        />
                        Strict Chronology Mode
                      </label>
                      {linkStrictChronology && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-slate-500">
                              Manual Floor Date (optional — khaali chhodo toh system khud "last known video" ki date use karega, aur naya video add hote hi ye date automatically aage badh jayegi)
                            </label>
                            <input
                              type="date"
                              value={linkChronologyFloorDate}
                              onChange={(e) => setLinkChronologyFloorDate(e.target.value)}
                              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">
                              Grace Gap (kitna part-number jump allow karo, 0 = sirf exact next part)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={linkChronologyGraceGap}
                              onChange={(e) => setLinkChronologyGraceGap(e.target.value)}
                              placeholder="0"
                              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Sequential agla episode (jaise 1→2, ya grace gap ke andar) floor date ke baad ho to seedha auto-add hoga.
                            Bade gap wala episode manual review me jayega. Floor date se pehle ka koi bhi video hamesha ignore hoga.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveLinkForm(ch._id)}
                          disabled={savingLink || !linkPageId}
                          className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs rounded-lg border border-white/10"
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

      {/* Channel Feed (conditional) */}
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
  };

  // Main render
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          {Icon.eye('w-4 h-4 text-sky-400')} Tracked Channels
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-medium">
            {filteredChannels.length}/{channels.length}
          </span>

          {/* 🆕 Added-by filter — sirf super-admin ko dikhega */}
          {!isSubAdmin && (
            <select
              value={addedByFilter}
              onChange={(e) => setAddedByFilter(e.target.value)}
              title="Kis admin ne channel add kiya, uske hisaab se filter karo"
              className="bg-gray-800/60 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="main">👑 Main Admin (default)</option>
              <option value="all">🌐 Sab Dikhao</option>
              {subAdminOwners.map((sa) => (
                <option key={sa.id} value={sa.id}>
                 🏛️ {sa.username}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2')}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Channel or title Find..."
              className="w-48 bg-gray-800/60 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>
      </div>

      {/* Add Channel form */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <div className="flex gap-2">
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !adding && addChannel()}
            placeholder="YouTube channel handle daalo (jaise @ChannelName)"
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            onClick={addChannel}
            disabled={adding || !newHandle.trim()}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1.5 flex-shrink-0"
          >
            {adding ? Icon.spinner('w-4 h-4') : Icon.plus('w-4 h-4')}
            Channel Add Karo
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
          <p className="text-slate-500 text-sm">Koi channel track nahi ho raha</p>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-white/10">
          <p className="text-slate-500 text-sm">
            {searchQuery.trim()
              ? 'Is naam ka koi channel nahi mila'
              : !isSubAdmin && addedByFilter === 'main'
              ? 'Main admin ne abhi tak koi channel add nahi kiya. Filter se "Sab Dikhao" select karo sub-admins ke channels dekhne ke liye.'
              : !isSubAdmin && addedByFilter !== 'all'
              ? 'Is sub-admin ne abhi tak koi channel add nahi kiya'
              : 'Koi channel nahi mila'}
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
                  isOpen ? 'border-white/30' : 'border-white/10'
                }`}
              >
                <button
                  onClick={() => setSelectedChannelId(isOpen ? null : ch._id)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition ${
                    isOpen ? 'bg-white/10' : 'hover:bg-white/[0.03]'
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
                    <p className="font-semibold text-white text-sm truncate" title={primaryName}>
                      {primaryName}
                      {matchedTitles.length > 1 && !channelNameMatch ? ` +${matchedTitles.length - 1} more` : ''}
                    </p>
                    {subtitle && (
                      <p className="text-[10px] text-slate-400 truncate" title={subtitle}>
                        {subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-medium">
                        {ch.titles.length} titles
                      </span>
                      {/* 🆕 Kis sub-admin ne add kiya — sirf main admin ko dikhega */}
                      {!isSubAdmin && ch.createdByUsername && ch.createdBy !== 'admin' && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium flex items-center gap-1"
                          title={`Is channel ko "${ch.createdByUsername}" (sub-admin) ne add kiya tha`}
                        >
                          +_+ {ch.createdByUsername}
                        </span>
                      )}
                      {ch.paused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium flex items-center gap-1">
                          {Icon.pause('w-2.5 h-2.5')} Paused
                        </span>
                      )}
                      {!!ch.consecutiveErrors && ch.consecutiveErrors > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium flex items-center gap-1">
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