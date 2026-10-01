// src/components/admin/TrackTitleBrowsePanel.tsx
import React, { useState } from 'react';
import { AnimeOption } from '../../types/trackTypes';
import { Icon, formatIST, formatDuration, pageLabel } from '../../utils/trackUtils';
import { SearchableDropdown } from './TrackChannelsPanel';

interface Props {
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
  closeBrowseTitle: () => void;
  setEnlargedVideoId: (videoId: string | null) => void;
  animeOptions: AnimeOption[];
  bulkAnimeId: string;
  bulkPageId: string;
  setBulkPageId: (id: string) => void;
  fetchBulkPages: (animeId: string) => void;
  bulkPages: any[];
  finalizing: boolean;
  bulkIgnoring: boolean;
  quickApproveSequential: () => void;
  isSequentialLowRisk: (videos: any[]) => boolean;
}

const TrackTitleBrowsePanel: React.FC<Props> = ({
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
  closeBrowseTitle,
  setEnlargedVideoId,
  animeOptions,
  bulkAnimeId,
  bulkPageId,
  setBulkPageId,
  fetchBulkPages,
  bulkPages,
  finalizing,
  bulkIgnoring,
  quickApproveSequential,
  isSequentialLowRisk,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
      {browseLoading ? (
        <div className="flex justify-center py-6">{Icon.spinner('w-5 h-5 text-slate-400')}</div>
      ) : browseData ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b border-white/10 bg-black/20">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white break-words">{browseData.keyword}</h4>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>
                  {browseData.videos.length} video(s) · last known part: {browseData.lastKnownPart}
                </span>
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

          {/* Controls */}
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
                  {browseData.videos?.every((v: any) => selectedVideoIds.has(v.videoId)) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs text-slate-400 font-medium">{selectedVideoIds.size} selected</span>
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
                Wrong part number detected? Enter the correct number or range (like 1-50) in that video's box.
              </span>
            </p>
          </div>

          {/* Video list */}
          <div className="max-h-[340px] overflow-y-auto p-2 sm:p-3 space-y-2">
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
                        ? 'bg-sky-500/10 border-sky-500/40'
                        : 'bg-black/20 hover:bg-black/30 border-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVideoSelect(v.videoId)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 flex-shrink-0 mt-1 accent-sky-500"
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingId((prev) => (prev === v.videoId ? null : v.videoId));
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 hover:text-sky-300 flex-shrink-0 border border-sky-500/20"
                          >
                            {playingId === v.videoId ? 'Close' : 'Watch'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              ignoreVideo(v.videoId);
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:text-red-300 flex-shrink-0 border border-red-500/20"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </div>

                    {playingId === v.videoId && (
                      <div
                        className="mt-2 aspect-video rounded-lg overflow-hidden border border-white/10 bg-black"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`}
                          title={v.videoTitle}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen
                        />
                      </div>
                    )}

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

          {/* Approval */}
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

export default TrackTitleBrowsePanel;