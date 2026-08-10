 import React, { useState } from 'react';
import { TrackNotification, TrackedChannel, AnimeOption } from '../../types/trackTypes';
import { Icon, formatIST, formatDuration, pageLabel } from '../../utils/trackUtils';

/* ---------- Searchable Dropdown (self-contained, TrackChannelsPanel jaisa hi) ---------- */
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

interface TrackNotificationsPanelProps {
  notifications: TrackNotification[];
  showAllUpdates: boolean;
  setShowAllUpdates: React.Dispatch<React.SetStateAction<boolean>>;
  globalUnreadCount: number;
  markAllDoneInList: (list: TrackNotification[]) => void;
  deleteAllInList: (list: TrackNotification[]) => void;
  markDone: (id: string) => void;
  deleteNotification: (id: string) => void;
  shareVideo: (url: string) => void;
  resolveSeasonChange: (notif: TrackNotification) => void;
  undoNotification: (n: TrackNotification) => void;
  undoing: Record<string, boolean>;
  channels: TrackedChannel[];
  // ✅ CHANGED — ab ye seedha inline browse panel kholega, channel section jump nahi karega
  openBrowseTitle: (channelId: string, titleId: string, keyword: string, depth?: number) => void;
  closeBrowseTitle: () => void;
  setNotificationDeleteConfirm: (v: any) => void;
  setEnlargedVideoId: (videoId: string | null) => void;
  setSelectedChannelId: (id: string | null) => void;
  // ✅ NEW — inline approve/browse panel ke liye zaroori state + actions
  animeOptions: AnimeOption[];
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
}

// ✅ Config-driven badge system — pehle har notifType ke liye alag JSX block
// repeat ho raha tha. Ab ek jagah se sab badges control hote hain: naya type
// add karna ho to bas is object me ek entry add karo.
const NOTIF_TYPE_BADGE: Record<
  string,
  { label: string; icon?: keyof typeof Icon; className: string }
> = {
  needs_approval: {
    label: 'Approval Chahiye',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  season_change: {
    label: 'Season Change',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  limit_reached: {
    label: 'Limit Reached',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  manual_review: {
    label: 'Manual Review',
    className: 'bg-white/10 text-slate-300 border-white/20',
  },
  auto_paused: {
    label: 'Auto-Paused',
    icon: 'ban',
    className: 'bg-red-600/20 text-red-300 border-red-600/40',
  },
};

function TypeBadge({ type }: { type?: string }) {
  const cfg = type ? NOTIF_TYPE_BADGE[type] : undefined;
  if (!cfg) return null;
  const IconEl = cfg.icon ? (Icon as any)[cfg.icon]('w-2.5 h-2.5') : null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cfg.className}`}
    >
      {IconEl}
      {cfg.label}
    </span>
  );
}

const TrackNotificationsPanel: React.FC<TrackNotificationsPanelProps> = ({
  notifications,
  showAllUpdates,
  setShowAllUpdates,
  globalUnreadCount,
  markAllDoneInList,
  deleteAllInList,
  markDone,
  deleteNotification,
  shareVideo,
  resolveSeasonChange,
  undoNotification,
  undoing,
  channels,
  openBrowseTitle,
  closeBrowseTitle,
  setNotificationDeleteConfirm,
  setEnlargedVideoId,
  setSelectedChannelId,
  animeOptions,
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
}) => {
  const pendingGlobalNotifs = showAllUpdates ? notifications : notifications.filter((n) => !n.isRead);

  // ============ ✅ NEW — inline browse/approve panel (channel section jump nahi karta) ============
  const renderBrowsePanel = () => {
    if (!browsingTitle) return null;
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
                      {Icon.checkAll('w-3.5 h-3.5')} Approve & Finalize (ab auto-tracking shuru ho)
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
  // ============================================================================================

  return (
    <div className="mt-3 bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* ============ HEADER ============ */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 bg-black/10">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-white">Updates</h3>
          {globalUnreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {globalUnreadCount} naye
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowAllUpdates((v) => !v)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
          >
            {showAllUpdates ? 'Sirf Pending' : 'Sab Dikhao'}
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={() => markAllDoneInList(pendingGlobalNotifs)}
            disabled={pendingGlobalNotifs.length === 0}
            title="Sabko Done mark karo"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 transition flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
          >
            {Icon.checkAll('w-3 h-3')} Done
          </button>
          <button
            onClick={() => deleteAllInList(pendingGlobalNotifs)}
            disabled={pendingGlobalNotifs.length === 0}
            title="Sabko hata do"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
          >
            {Icon.trash('w-3 h-3')} Remove
          </button>
        </div>
      </div>

      {/* ============ LIST ============ */}
      <div className="p-4 space-y-2.5">
        {pendingGlobalNotifs.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
              {Icon.checkAll('w-4 h-4')}
            </div>
            <p className="text-sm text-slate-500">
              {showAllUpdates ? 'Koi update nahi hai' : 'Sab kuch dekh liya hai — koi pending update nahi'}
            </p>
          </div>
        ) : (
          pendingGlobalNotifs.map((n) => {
            // ✅ NEW — ye notification hi wo hai jiske liye browse panel khula hai?
            const channelForNotif = channels.find((ch) => ch.channelId === n.channelId);
            const titleForNotif = channelForNotif?.titles.find((t: any) => t.keyword === n.titleKeyword) as any;
            const isThisOneBrowsing =
              !!browsingTitle &&
              !!titleForNotif &&
              browsingTitle.channelId === channelForNotif?._id &&
              browsingTitle.titleId === titleForNotif.id;

            return (
              <div
                key={n._id}
                className={`rounded-xl border transition ${
                  n.isRead
                    ? 'bg-black/10 border-white/5 opacity-60'
                    : 'bg-black/30 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  {/* ---- Thumbnail comparison ---- */}
                  {(n.oldThumbnail || n.newThumbnail) && (
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {n.oldThumbnail && (
                        <div className="text-center">
                          <img
                            src={n.oldThumbnail}
                            className="w-20 h-12 object-cover rounded-lg border border-white/10 opacity-60 cursor-zoom-in hover:opacity-90 transition"
                            onClick={() => n.oldVideoId && setEnlargedVideoId(n.oldVideoId)}
                          />
                          <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold">
                            Old · Part {n.oldPart ?? '?'}
                          </p>
                        </div>
                      )}
                      {n.oldThumbnail && n.newThumbnail && (
                        <span className="text-slate-500 self-center">→</span>
                      )}
                      {n.newThumbnail && (
                        <div className="text-center">
                          <img
                            src={n.newThumbnail}
                            className="w-20 h-12 object-cover rounded-lg border border-emerald-500/40 cursor-zoom-in hover:opacity-90 transition"
                            onClick={() => setEnlargedVideoId(n.newVideoId)}
                          />
                          <p className="text-[9px] text-emerald-400 mt-1 uppercase font-semibold">
                            New · Part {n.newPart}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- Content ---- */}
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {n.titleKeyword || n.channelName}
                      </p>
                      <TypeBadge type={n.notifType} />
                      {n.autoAdded && !n.undone && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          {Icon.check('w-2.5 h-2.5')} Auto-Added
                        </span>
                      )}
                      {n.undone && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-slate-500/15 text-slate-400 border-slate-500/30">
                          {Icon.undo('w-2.5 h-2.5')} Undone
                        </span>
                      )}
                    </div>

                    {n.newVideoTitle && (
                      <p className="text-[11px] text-slate-400 truncate">{n.newVideoTitle}</p>
                    )}

                    {/* Meta row */}
                    <p className="text-[10px] text-slate-600 mt-1">
                      {n.channelName} <span className="mx-1 text-slate-700">·</span> {formatIST(n.createdAt)}
                    </p>

                    {/* ---- Actions ---- */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-white/5">
                      {/* Contextual primary action(s) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                        {(n.notifType === 'needs_approval' || n.notifType === 'manual_review') && !n.isRead && (
                          <button
                            onClick={() => {
                              // ✅ FIX: ab seedha inline panel khulega, channel section jump nahi hoga
                              if (channelForNotif && titleForNotif) {
                                openBrowseTitle(channelForNotif._id, titleForNotif.id, titleForNotif.keyword);
                              }
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition flex items-center gap-1"
                          >
                            {Icon.eye('w-3 h-3')}{' '}
                            {isThisOneBrowsing
                              ? 'Band Karo'
                              : n.notifType === 'manual_review'
                              ? 'Dhoond Ke Add Karo'
                              : 'Approve Karo'}
                          </button>
                        )}
                        {n.autoAdded && !n.undone && n.linkedDownloadPageId && (
                          <button
                            onClick={() =>
                              setNotificationDeleteConfirm({
                                notificationId: `undo-${n._id}`,
                                title: n.titleKeyword || n.channelName,
                                isBulk: false,
                              })
                            }
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
                      </div>

                      {/* Status / destructive actions — pinned right */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {n.isRead ? (
                          <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-500">
                            Done
                          </span>
                        ) : (
                          <button
                            onClick={() => markDone(n._id)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1"
                          >
                            {Icon.check('w-3 h-3')} Mark as Done
                          </button>
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

                    {/* ✅ NEW — isi notification ke neeche inline browse/approve panel */}
                    {isThisOneBrowsing && renderBrowsePanel()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrackNotificationsPanel;