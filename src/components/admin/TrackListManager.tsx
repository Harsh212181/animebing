// src/components/admin/TrackListManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  TrackedChannel,
  TrackedTitle,
  Capacity,
  TrackNotification,
  RunLog,
  AnimeOption,
  PageOption,
  ConflictEntry,
  PreviewVideo,
} from '../../types/trackTypes';
import { Icon, formatIST, HighResThumb } from '../../utils/trackUtils';
import { getAdminToken, isSuperAdminSession } from '../../../utils/authToken';
import TrackChannelsPanel from './TrackChannelsPanel';
import TrackListLogs from './TrackListLogs';
import TrackNotificationsPanel from './TrackNotificationsPanel';
import TrackTitleBrowsePanel from './TrackTitleBrowsePanel';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

const MAX_SCAN_DEPTH = 10000;

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
  const [matchThresholdInputs, setMatchThresholdInputs] = useState<Record<string, number>>({});
  const [checkingNow, setCheckingNow] = useState<Record<string, boolean>>({});
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editLastPart, setEditLastPart] = useState('');
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [bulkModeChannel, setBulkModeChannel] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [showAllUpdatesGlobal, setShowAllUpdatesGlobal] = useState(false);

  const [syncingPage, setSyncingPage] = useState<Record<string, boolean>>({});
  const [syncingEpStatus, setSyncingEpStatus] = useState<Record<string, boolean>>({});
  const [refreshingInfo, setRefreshingInfo] = useState<Record<string, boolean>>({});
  const [togglingPause, setTogglingPause] = useState<Record<string, boolean>>({});

  const [showConflicts, setShowConflicts] = useState(false);
  const [showGlobalFeed, setShowGlobalFeed] = useState(false);
  const [showAllTitles, setShowAllTitles] = useState(false);

  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [pagesForAnime, setPagesForAnime] = useState<PageOption[]>([]);
  const [linkFormTitleId, setLinkFormTitleId] = useState<string | null>(null);
  const [linkAnimeId, setLinkAnimeId] = useState('');
  const [linkPageId, setLinkPageId] = useState('');
  const [linkLimit, setLinkLimit] = useState('0');
  const [linkMergeMode, setLinkMergeMode] = useState(true);
  const [linkBaselineMin, setLinkBaselineMin] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const [linkStrictChronology, setLinkStrictChronology] = useState(false);
  const [linkChronologyFloorDate, setLinkChronologyFloorDate] = useState('');
  const [linkChronologyGraceGap, setLinkChronologyGraceGap] = useState('0');

  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

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

  const [previewForChannel, setPreviewForChannel] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<{ matchedCount: number; videos: PreviewVideo[] } | null>(null);
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());
  const [previewBulkAnimeId, setPreviewBulkAnimeId] = useState('');
  const [previewBulkPageId, setPreviewBulkPageId] = useState('');
  const [previewBulkPages, setPreviewBulkPages] = useState<any[]>([]);
  const [previewEpisodeOverrides, setPreviewEpisodeOverrides] = useState<Record<string, string>>({});
  const [previewAdding, setPreviewAdding] = useState(false);

  const [previewScanDepth, setPreviewScanDepth] = useState(50);
  const [browseScanDepth, setBrowseScanDepth] = useState(150);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  const [lastPreviewDepth, setLastPreviewDepth] = useState<Record<string, number>>({});
  const [previewProgress, setPreviewProgress] = useState<{ scanned: number; target: number } | null>(null);
  const previewCursorRef = useRef<Record<string, string | null>>({});
  const previewCancelRef = useRef(false);

  const [enlargedVideoId, setEnlargedVideoId] = useState<string | null>(null);

  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);

  const [undoing, setUndoing] = useState<Record<string, boolean>>({});

  const [clearingLogs, setClearingLogs] = useState(false);
  const [clearingRuns, setClearingRuns] = useState(false);

  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{ channelId: string; channelName: string } | null>(null);
  const [deletingChannel, setDeletingChannel] = useState(false);

  const [notificationDeleteConfirm, setNotificationDeleteConfirm] = useState<{
    notificationId: string;
    count?: number;
    isBulk?: boolean;
    title?: string;
  } | null>(null);
  const [deletingNotification, setDeletingNotification] = useState(false);

  const [showChannelFeed, setShowChannelFeed] = useState<Record<string, boolean>>({});

  const pendingRef = useRef<Set<string>>(new Set());

  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try {
      await fn();
    } catch {
      // each action shows its own toast
    } finally {
      pendingRef.current.delete(key);
    }
  };

  const isSubAdminContext = !isSuperAdminSession();
  const authHeaders = () => ({ headers: { Authorization: `Bearer ${getAdminToken()}` } });

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
      toast.error('Could not load data');
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
        setAnimeOptions(
          arr.map((a: any) => ({
            _id: a._id,
            title: a.title,
            thumbnail: normalizeThumb(a) || undefined,
          }))
        );
      }
    } catch {
      // silent
    }
  };

  const fetchPagesForAnime = async (animeId: string) => {
    if (!animeId) {
      setPagesForAnime([]);
      return;
    }
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
    await guarded('run-all-now', async () => {
      setRunningAll(true);
      try {
        const { data } = await axios.post(`${API_BASE}/track/run-all-now`, {}, authHeaders());
        toast.success(
          `Test run complete! ${data.channelsChecked} channels checked, ${data.updatesFound} updates found${
            data.errorCount > 0 ? `, ${data.errorCount} error` : ''
          }`
        );
        setShowRunHistory(true);
        loadData();
      } catch {
        toast.error('Test run failed');
      } finally {
        setRunningAll(false);
      }
    });
  };

  const clearAllLogs = () => {
    setNotificationDeleteConfirm({
      notificationId: 'all-logs',
      count: logs.length,
      isBulk: true,
      title: 'All Check Logs',
    });
  };

  const confirmClearLogs = async () => {
    await guarded('clear-logs', async () => {
      setDeletingNotification(true);
      try {
        const { data } = await axios.delete(`${API_BASE}/track/logs/clear-all`, authHeaders());
        toast.success(`${data.count} logs cleared`);
        loadData();
      } catch {
        toast.error('Could not clear');
      } finally {
        setDeletingNotification(false);
        setNotificationDeleteConfirm(null);
      }
    });
  };

  const clearAllRuns = () => {
    setNotificationDeleteConfirm({
      notificationId: 'all-runs',
      count: runs.length,
      isBulk: true,
      title: 'All Run History',
    });
  };

  const confirmClearRuns = async () => {
    await guarded('clear-runs', async () => {
      setDeletingNotification(true);
      try {
        const { data } = await axios.delete(`${API_BASE}/track/runs/clear-all`, authHeaders());
        toast.success(`${data.count} runs cleared`);
        loadData();
      } catch {
        toast.error('Could not clear');
      } finally {
        setDeletingNotification(false);
        setNotificationDeleteConfirm(null);
      }
    });
  };

  const addChannel = async () => {
    await guarded('add-channel', async () => {
      if (!newHandle.trim()) return;
      setAdding(true);
      try {
        const { data } = await axios.post(`${API_BASE}/track/channel/add`, { handle: newHandle.trim() }, authHeaders());
        if (data.success) {
          toast.success(
            data.alreadyTracked
              ? `"${data.channelName}" already tracked — added to your list, now add your title`
              : `"${data.channelName}" added`
          );
          setNewHandle('');
          loadData();
        } else {
          toast.error(data.error || 'Could not add');
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Could not add');
      } finally {
        setAdding(false);
      }
    });
  };

  const removeChannel = (channelId: string, channelName: string) => {
    setChannelDeleteConfirm({ channelId, channelName });
  };

  const confirmDeleteChannel = async () => {
    await guarded('delete-channel', async () => {
      if (!channelDeleteConfirm) return;
      setDeletingChannel(true);
      try {
        await axios.delete(`${API_BASE}/track/channel/${channelDeleteConfirm.channelId}`, authHeaders());
        toast.success('Channel removed');
        if (selectedChannelId === channelDeleteConfirm.channelId) setSelectedChannelId(null);
        loadData();
      } catch {
        toast.error('Could not remove');
      } finally {
        setDeletingChannel(false);
        setChannelDeleteConfirm(null);
      }
    });
  };

  const refreshChannelInfo = async (channelId: string) => {
    await guarded(`refresh-info-${channelId}`, async () => {
      setRefreshingInfo((prev) => ({ ...prev, [channelId]: true }));
      try {
        await axios.post(`${API_BASE}/track/channel/${channelId}/refresh-info`, {}, authHeaders());
        toast.success('Logo/name updated');
        loadData();
      } catch {
        toast.error('Could not refresh');
      } finally {
        setRefreshingInfo((prev) => ({ ...prev, [channelId]: false }));
      }
    });
  };

  const togglePause = async (channelId: string) => {
    await guarded(`toggle-pause-${channelId}`, async () => {
      setTogglingPause((prev) => ({ ...prev, [channelId]: true }));
      try {
        const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/toggle-pause`, {}, authHeaders());
        toast.success(data.paused ? 'Channel paused' : 'Channel resumed (error counter reset)');
        loadData();
      } catch {
        toast.error('Pause/Resume failed');
      } finally {
        setTogglingPause((prev) => ({ ...prev, [channelId]: false }));
      }
    });
  };

  const checkNow = async (channelId: string) => {
    await guarded(`check-now-${channelId}`, async () => {
      setCheckingNow((prev) => ({ ...prev, [channelId]: true }));
      try {
        const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/check-now`, {}, authHeaders());
        toast.success(data.updatesFound > 0 ? `${data.updatesFound} new update(s) found!` : 'No new update found');
        loadData();
      } catch {
        toast.error('Check failed (if this keeps happening, the channel may get auto-paused)');
        loadData();
      } finally {
        setCheckingNow((prev) => ({ ...prev, [channelId]: false }));
      }
    });
  };

  // ============ PREVIEW ============
  const cancelPreview = () => {
    previewCancelRef.current = true;
  };

  const byPart = (a: PreviewVideo, b: PreviewVideo) =>
    a.part === null && b.part === null
      ? 0
      : a.part === null
      ? 1
      : b.part === null
      ? -1
      : a.part - b.part;

  const runPreview = async (channelId: string, continueScan = false) => {
    await guarded(`preview-${channelId}`, async () => {
      const keyword = titleInputs[channelId]?.trim();
      if (!keyword) {
        toast.error('Write a keyword first, then press Preview');
        return;
      }
      const excludeKeywords = (excludeKeywordsInputs[channelId] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const threshold = matchThresholdInputs[channelId] ?? 0.7;

      const alreadyScanned = continueScan ? lastPreviewDepth[channelId] ?? 0 : 0;
      const target = continueScan
        ? Math.min(MAX_SCAN_DEPTH, alreadyScanned + 1500)
        : Math.min(MAX_SCAN_DEPTH, previewScanDepth);

      let token: string | undefined = continueScan ? previewCursorRef.current[channelId] || undefined : undefined;
      if (continueScan && !token) {
        toast('Channel ke sabse purane video tak scan ho chuka hai');
        return;
      }

      const map = new Map<string, PreviewVideo>(
        continueScan
          ? (previewResults?.videos ?? []).map((v) => [v.videoId, v] as [string, PreviewVideo])
          : []
      );
      if (!continueScan) {
        setPreviewResults(null);
        setPreviewSelectedIds(new Set());
        setPreviewEpisodeOverrides({});
        previewCursorRef.current[channelId] = null;
      }

      previewCancelRef.current = false;
      setPreviewLoading(true);
      let scanned = alreadyScanned;
      setPreviewProgress({ scanned, target });

      try {
        while (scanned < target && !previewCancelRef.current) {
          const pages = Math.max(1, Math.min(20, Math.ceil((target - scanned) / 50)));
          const body = { keyword, excludeKeywords, matchThreshold: threshold, pageToken: token, pages };
          const url = `${API_BASE}/track/channel/${channelId}/title/test-match-chunk`;

          let data: any;
          try {
            ({ data } = await axios.post(url, body, authHeaders()));
          } catch {
            ({ data } = await axios.post(url, body, authHeaders()));
          }

          scanned += data.scannedCount;
          for (const v of data.videos) map.set(v.videoId, v);
          token = data.nextPageToken || undefined;

          const videos = Array.from(map.values()).sort(byPart);
          setPreviewResults({ matchedCount: videos.length, videos });
          setPreviewProgress({ scanned, target });
          previewCursorRef.current[channelId] = token ?? null;
          setLastPreviewDepth((prev) => ({ ...prev, [channelId]: scanned }));

          if (!token) break;
        }
        if (map.size === 0) toast('No video matched this keyword — try changing the keyword');
      } catch (err: any) {
        toast.error('Preview beech mein ruk gaya — ab tak ka result dikh raha hai, "Search Older" se aage badho');
      } finally {
        setPreviewLoading(false);
        setPreviewProgress(null);
      }
    });
  };

  const scanPreviewDeeper = (channelId: string) => {
    if ((lastPreviewDepth[channelId] ?? 0) >= MAX_SCAN_DEPTH) {
      toast('Max depth (10000) reached');
      return;
    }
    runPreview(channelId, true);
  };

  const fetchPreviewBulkPages = async (animeId: string) => {
    setPreviewBulkAnimeId(animeId);
    setPreviewBulkPageId('');
    if (!animeId) {
      setPreviewBulkPages([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`, authHeaders());
      if (Array.isArray(res.data)) setPreviewBulkPages(res.data);
    } catch {
      setPreviewBulkPages([]);
    }
  };

  const togglePreviewVideoSelect = (videoId: string) => {
    setPreviewSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const selectAllPreviewVideos = () => {
    if (!previewResults?.videos) return;
    const allIds = previewResults.videos.map((v) => v.videoId);
    const allSelected = allIds.every((id) => previewSelectedIds.has(id));
    setPreviewSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const doPreviewBulkAdd = async (channelId: string) => {
    await guarded(`preview-add-${channelId}`, async () => {
      const keyword = titleInputs[channelId]?.trim();
      if (!keyword || !previewBulkPageId || previewSelectedIds.size === 0) return;
      setPreviewAdding(true);

      const overridesToSend: Record<string, string> = {};
      for (const vid of previewSelectedIds) {
        const raw = previewEpisodeOverrides[vid];
        if (raw !== undefined && raw.trim() !== '') overridesToSend[vid] = raw.trim();
      }

      const ids = Array.from(previewSelectedIds);
      const BATCH = 250;
      let added = 0;
      let failedBatches = 0;
      let lastError = '';

      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const batchOverrides: Record<string, string> = {};
        for (const id of batch) if (overridesToSend[id] !== undefined) batchOverrides[id] = overridesToSend[id];
        try {
          const { data } = await axios.post(
            `${API_BASE}/track/channel/${channelId}/quick-bulk-add`,
            {
              keyword,
              matchThreshold: matchThresholdInputs[channelId] ?? 0.7,
              excludeKeywords: (excludeKeywordsInputs[channelId] || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              scanDepth: Math.min(2000, lastPreviewDepth[channelId] ?? previewScanDepth),
              downloadPageId: previewBulkPageId,
              videoIds: batch,
              episodeOverrides: batchOverrides,
            },
            authHeaders()
          );
          added += data.added || 0;
        } catch (err: any) {
          failedBatches++;
          lastError = err.response?.data?.error || 'Could not add';
        }
      }

      if (failedBatches === 0) {
        toast.success(`${added} episodes added directly!`);
        setPreviewSelectedIds(new Set());
        setPreviewEpisodeOverrides({});
      } else {
        toast.error(
          `${added} added, ${failedBatches} batch fail (${lastError}). Dobara "Add Selected" dabana safe hai, duplicates skip ho jaate hain.`
        );
      }
      setPreviewAdding(false);
    });
  };

  // ============ TITLE ACTIONS ============
  const addTitle = async (channelId: string, keyword: string, excludeKeywords: string[]) => {
    await guarded(`add-title-${channelId}`, async () => {
      const kw = keyword.trim();
      if (!kw) return;
      try {
        await axios.post(
          `${API_BASE}/track/channel/${channelId}/title/add`,
          {
            keyword: kw,
            currentKnownPart: 0,
            excludeKeywords,
            matchThreshold: matchThresholdInputs[channelId] ?? 0.7,
            autoInit: true,
          },
          authHeaders()
        );
        toast.success(`"${kw}" added`);
        setTitleInputs({ ...titleInputs, [channelId]: '' });
        setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [channelId]: '' });
        setPreviewResults(null);
        setPreviewForChannel(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Could not add title');
      }
    });
  };

  const addBulkTitles = async (channelId: string, bulkTextValue: string) => {
    await guarded(`bulk-titles-${channelId}`, async () => {
      const lines = bulkTextValue.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      try {
        const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/title/bulk-add`, { keywords: lines }, authHeaders());
        toast.success(`${data.added} titles added${data.skipped?.length ? `, ${data.skipped.length} already existed` : ''}`);
        setBulkText('');
        setBulkModeChannel(null);
        loadData();
      } catch {
        toast.error('Something failed in bulk add');
      }
    });
  };

  const cancelEditTitle = () => {
    setEditingTitle(null);
    setEditKeyword('');
    setEditLastPart('');
  };

  const saveEditTitle = async (channelId: string, titleId: string, keyword: string, lastPart: number) => {
    await guarded(`save-edit-${titleId}`, async () => {
      try {
        await axios.put(
          `${API_BASE}/track/channel/${channelId}/title/${titleId}/edit`,
          { keyword: keyword.trim(), lastKnownPart: lastPart || 0 },
          authHeaders()
        );
        toast.success('Title updated');
        cancelEditTitle();
        loadData();
      } catch {
        toast.error('Could not update');
      }
    });
  };

  const removeTitle = async (channelId: string, titleId: string) => {
    await guarded(`remove-title-${titleId}`, async () => {
      try {
        await axios.delete(`${API_BASE}/track/channel/${channelId}/title/${titleId}`, authHeaders());
        toast.success('Title removed');
        loadData();
      } catch {
        toast.error('Could not remove');
      }
    });
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
    setLinkStrictChronology(anyT.strictChronology === true);
    setLinkChronologyFloorDate(anyT.chronologyFloorDate || '');
    setLinkChronologyGraceGap(String(anyT.chronologyGraceGap ?? 0));
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
    setLinkStrictChronology(false);
    setLinkChronologyFloorDate('');
    setLinkChronologyGraceGap('0');
  };

  const saveLinkForm = async (channelId: string) => {
    await guarded('save-link', async () => {
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
            strictChronology: linkStrictChronology,
            chronologyFloorDate: linkChronologyFloorDate || null,
            chronologyGraceGap: Number(linkChronologyGraceGap) || 0,
          },
          authHeaders()
        );
        if (data.warning) {
          toast(data.warning, { duration: 6000 });
        } else {
          toast.success('Page linked!');
        }
        closeLinkForm();
        loadData();
      } catch {
        toast.error('Could not save link');
      } finally {
        setSavingLink(false);
      }
    });
  };

  const unlinkTitle = async (channelId: string, titleId: string) => {
    await guarded(`unlink-${titleId}`, async () => {
      try {
        await axios.put(
          `${API_BASE}/track/channel/${channelId}/title/${titleId}/link`,
          { linkedAnimeId: null, linkedDownloadPageId: null, episodeLimit: 0, resetSeason: true },
          authHeaders()
        );
        toast.success('Unlinked');
        loadData();
      } catch {
        toast.error('Unlink failed');
      }
    });
  };

  // ============ ALL TITLES BROWSE ============
  const allTitlesFlat = channels.flatMap((ch) =>
    (ch.titles || []).map((t: any) => ({
      ...t,
      channelId: ch._id,
      channelName: ch.channelName,
      channelThumbnail: ch.channelThumbnail,
    }))
  );

  const approvalPendingCount = allTitlesFlat.filter((t: any) => t.initialized === false).length;
  const manualReviewCount = notifications.filter((n) => n.notifType === 'manual_review' && !n.isRead).length;
  const pausedOrErrorCount = channels.filter((ch) => ch.paused || (ch.consecutiveErrors && ch.consecutiveErrors > 0)).length;

  const filteredAllTitles = allTitlesFlat.filter((t: any) => {
    const q = allTitlesSearch.trim().toLowerCase();
    if (!q) return true;
    const animeTitle = (animeOptions.find((a) => a._id === t.linkedAnimeId)?.title || '').toLowerCase();
    return (
      t.keyword.toLowerCase().includes(q) ||
      t.channelName?.toLowerCase().includes(q) ||
      animeTitle.includes(q)
    );
  });

  const isSequentialLowRisk = (videos: any[]): boolean => {
    const parts = Array.from(new Set(videos.filter((v: any) => v.part !== null).map((v: any) => v.part))).sort(
      (a: any, b: any) => a - b
    );
    if (parts.length < 2) return false;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] !== parts[i - 1] + 1) return false;
    }
    return true;
  };

  const quickApproveSequential = async () => {
    await guarded('quick-approve', async () => {
      if (!browsingTitle || !bulkPageId || !browseData?.videos) {
        toast.error('Select a page and load videos first');
        return;
      }
      const allIds = browseData.videos.map((v: any) => v.videoId);
      setSelectedVideoIds(new Set(allIds));
      setFinalizing(true);
      try {
        const overridesToSend: Record<string, string> = {};
        for (const vid of allIds) {
          const raw = episodeOverrides[vid];
          if (raw !== undefined && raw.trim() !== '') {
            overridesToSend[vid] = raw.trim();
          }
        }
        await axios.post(
          `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/bulk-add`,
          { downloadPageId: bulkPageId, videoIds: allIds, episodeOverrides: overridesToSend },
          authHeaders()
        );
        await axios.post(
          `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/finalize-initial`,
          {},
          authHeaders()
        );
        toast.success('Quick Approve done — all episodes added + auto-tracking ON!');
        closeBrowseTitle();
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Quick approve failed');
      } finally {
        setFinalizing(false);
      }
    });
  };

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

      const ch = channels.find((c) => c._id === channelId);
      const t = ch?.titles.find((tt: any) => tt.id === titleId) as any;
      if (t?.linkedAnimeId && t?.linkedDownloadPageId) {
        setBulkAnimeId(t.linkedAnimeId);
        try {
          const res = await axios.get(`${API_BASE}/download-pages/anime/${t.linkedAnimeId}`, authHeaders());
          if (Array.isArray(res.data)) setBulkPages(res.data);
        } catch {
          setBulkPages([]);
        }
        setBulkPageId(t.linkedDownloadPageId);
      } else {
        setBulkPageId('');
        setBulkAnimeId('');
      }
    }
    try {
      const res = await axios.get(`${API_BASE}/track/channel/${channelId}/title/${titleId}/all-videos?depth=${useDepth}`, authHeaders());
      setBrowseData(res.data);
    } catch {
      toast.error('Could not load videos');
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
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
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
    if (!animeId) {
      setBulkPages([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`, authHeaders());
      if (Array.isArray(res.data)) setBulkPages(res.data);
    } catch {
      setBulkPages([]);
    }
  };

  const doBulkAdd = async () => {
    await guarded('bulk-add', async () => {
      if (!browsingTitle || !bulkPageId || selectedVideoIds.size === 0) return;
      setFinalizing(true);
      try {
        const overridesToSend: Record<string, string> = {};
        for (const vid of selectedVideoIds) {
          const raw = episodeOverrides[vid];
          if (raw !== undefined && raw.trim() !== '') {
            overridesToSend[vid] = raw.trim();
          }
        }
        const { data } = await axios.post(
          `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/bulk-add`,
          { downloadPageId: bulkPageId, videoIds: Array.from(selectedVideoIds), episodeOverrides: overridesToSend },
          authHeaders()
        );
        toast.success(`${data.added} episodes added!`);
        setSelectedVideoIds(new Set());
        setEpisodeOverrides({});
        openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Could not add');
      } finally {
        setFinalizing(false);
      }
    });
  };

  const ignoreVideo = async (videoId: string) => {
    await guarded(`ignore-video-${videoId}`, async () => {
      if (!browsingTitle) return;
      try {
        await axios.post(
          `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/ignore-video`,
          { videoId },
          authHeaders()
        );
        toast.success('Video ignored, it will never show again');
        openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
      } catch {
        toast.error('Ignore failed');
      }
    });
  };

  const bulkIgnoreSelected = async () => {
    await guarded('bulk-ignore', async () => {
      if (!browsingTitle || selectedVideoIds.size === 0) return;
      setBulkIgnoring(true);
      try {
        const ids = Array.from(selectedVideoIds);
        await axios.post(
          `${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/ignore-videos-bulk`,
          { videoIds: ids },
          authHeaders()
        );
        toast.success(`${ids.length} video(s) ignored`);
        setSelectedVideoIds(new Set());
        setEpisodeOverrides({});
        openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
      } catch {
        toast.error('Something failed in bulk ignore');
      } finally {
        setBulkIgnoring(false);
      }
    });
  };

  const finalizeApproval = async () => {
    await guarded('finalize-approval', async () => {
      if (!browsingTitle) return;
      setFinalizing(true);
      try {
        await axios.post(`${API_BASE}/track/channel/${browsingTitle.channelId}/title/${browsingTitle.titleId}/finalize-initial`, {}, authHeaders());
        toast.success('Approved! New episodes will now be added automatically.');
        closeBrowseTitle();
        loadData();
      } catch {
        toast.error('Finalize failed');
      } finally {
        setFinalizing(false);
      }
    });
  };

  const scanBrowseDeeper = () => {
    if (!browsingTitle) return;
    const next = browseScanDepth + 150;
    openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword, next);
  };

  // ============ NOTIFICATION ACTIONS ============
  const markDone = async (id: string) => {
    await guarded(`mark-done-${id}`, async () => {
      try {
        await axios.post(`${API_BASE}/track/notifications/${id}/read`, {}, authHeaders());
        loadData();
      } catch {
        toast.error('Could not mark');
      }
    });
  };

  const deleteNotification = (id: string) => {
    const notif = notifications.find((n) => n._id === id);
    if (notif) {
      setNotificationDeleteConfirm({
        notificationId: id,
        title: notif.titleKeyword || notif.channelName,
        isBulk: false,
      });
    }
  };

  const confirmDeleteNotification = async () => {
    await guarded('delete-notification', async () => {
      if (!notificationDeleteConfirm) return;
      setDeletingNotification(true);
      try {
        await axios.delete(`${API_BASE}/track/notifications/${notificationDeleteConfirm.notificationId}`, authHeaders());
        toast.success('Removed');
        loadData();
      } catch {
        toast.error('Could not remove');
      } finally {
        setDeletingNotification(false);
        setNotificationDeleteConfirm(null);
      }
    });
  };

  const markAllDoneInList = async (list: TrackNotification[]) => {
    await guarded('mark-all-done', async () => {
      const unread = list.filter((n) => !n.isRead);
      if (unread.length === 0) return;
      try {
        await Promise.all(unread.map((n) => axios.post(`${API_BASE}/track/notifications/${n._id}/read`, {}, authHeaders())));
        toast.success(`${unread.length} updates marked "Done"`);
        loadData();
      } catch {
        toast.error('Mark all failed');
      }
    });
  };

  const deleteAllInList = (list: TrackNotification[]) => {
    if (list.length === 0) return;
    setNotificationDeleteConfirm({
      notificationId: 'bulk-notifications',
      count: list.length,
      isBulk: true,
      title: 'All Notifications in this list',
    });
    pendingBulkDeleteRef.current = list;
  };

  const pendingBulkDeleteRef = React.useRef<TrackNotification[]>([]);

  const confirmBulkDeleteNotifications = async () => {
    await guarded('bulk-delete-notifications', async () => {
      if (!notificationDeleteConfirm || notificationDeleteConfirm.notificationId !== 'bulk-notifications') return;
      setDeletingNotification(true);
      try {
        const currentList = pendingBulkDeleteRef.current;
        await Promise.all(currentList.map((n) => axios.delete(`${API_BASE}/track/notifications/${n._id}`, authHeaders())));
        toast.success(`${currentList.length} updates removed`);
        loadData();
      } catch {
        toast.error('Clear all failed');
      } finally {
        setDeletingNotification(false);
        setNotificationDeleteConfirm(null);
        pendingBulkDeleteRef.current = [];
      }
    });
  };

  const shareVideo = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy');
    }
  };

  const resolveSeasonChange = async (notif: TrackNotification) => {
    await guarded(`resolve-season-${notif._id}`, async () => {
      const slug = prompt('Enter the new season page slug (e.g. series-name-season-2):');
      if (!slug) return;
      const channel = channels.find((ch) => (ch.titles || []).some((t: any) => t.keyword === notif.titleKeyword));
      const title = channel?.titles.find((t: any) => t.keyword === notif.titleKeyword) as any;
      if (!title || !channel) {
        toast.error('Title/channel not found');
        return;
      }
      try {
        await axios.post(`${API_BASE}/track/channel/${channel._id}/title/${title.id}/resolve-season`, { newSlug: slug }, authHeaders());
        toast.success('New page created, season change resolved!');
        markDone(notif._id);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed');
      }
    });
  };

  // ============ UNDO ============
  const undoNotification = (n: TrackNotification) => {
    setNotificationDeleteConfirm({
      notificationId: `undo-${n._id}`,
      title: n.titleKeyword || n.channelName,
      isBulk: false,
    });
  };

  const confirmUndoNotification = async () => {
    await guarded('undo-notification', async () => {
      if (!notificationDeleteConfirm || !notificationDeleteConfirm.notificationId.startsWith('undo-')) return;
      const notifId = notificationDeleteConfirm.notificationId.replace('undo-', '');
      const n = notifications.find((n) => n._id === notifId);
      if (!n) {
        setNotificationDeleteConfirm(null);
        return;
      }

      setDeletingNotification(true);
      try {
        await axios.post(`${API_BASE}/track/notifications/${n._id}/undo`, {}, authHeaders());
        toast.success('Undone — link removed from page');
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Undo failed');
      } finally {
        setDeletingNotification(false);
        setNotificationDeleteConfirm(null);
      }
    });
  };

  // ============ DERIVED DATA ============
  const pendingGlobalNotifs = showAllUpdatesGlobal ? notifications : notifications.filter((n) => !n.isRead);
  const globalUnreadCount = notifications.filter((n) => !n.isRead).length;

  const todayUpdatesCount = notifications.filter((n) => {
    const notifDate = new Date(n.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return notifDate === todayDate;
  }).length;

  const channelPercent = Math.min(100, (capacity.channelsUsed / capacity.channelsLimit) * 100);
  const unitsPercent = Math.min(100, (capacity.unitsUsedPerCheck / capacity.unitsLimit) * 100);

  const quickExcludes = [
    'Sub',
    'English Dub',
    'Tamil dub',
    'Telugu dub',
    'English sub',
    'Hindi dub',
    'Tamil sub',
    'Telugu sub',
    'Preview',
    'EN Sub',
  ];

  const addToExclude = (channelId: string, word: string) => {
    setExcludeKeywordsInputs((prev) => {
      const current = prev[channelId] || '';
      const items = current.split(',').map((s) => s.trim()).filter(Boolean);
      if (!items.includes(word)) {
        const newValue = items.length ? items.join(', ') + ', ' + word : word;
        return { ...prev, [channelId]: newValue };
      }
      return prev;
    });
  };

  /* ---------- Inline expand/collapse + sync helpers for All Titles panel ---------- */
  const toggleTitleInline = (t: any) => {
    const isOpen = browsingTitle?.channelId === t.channelId && browsingTitle?.titleId === t.id;
    if (isOpen) closeBrowseTitle();
    else openBrowseTitle(t.channelId, t.id, t.keyword);
  };

  const syncTitleWithPage = async (channelId: string, titleId: string) => {
    await guarded(`sync-page-${titleId}`, async () => {
      setSyncingPage((p) => ({ ...p, [titleId]: true }));
      try {
        const { data } = await axios.post(
          `${API_BASE}/track/channel/${channelId}/title/${titleId}/sync-with-page`,
          {},
          authHeaders()
        );
        toast.success(`Synced — now last known part: ${data.syncedToPart}`);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Sync failed');
      } finally {
        setSyncingPage((p) => ({ ...p, [titleId]: false }));
      }
    });
  };

  const syncTitleEpisode = async (channelId: string, titleId: string) => {
    await guarded(`sync-ep-${titleId}`, async () => {
      setSyncingEpStatus((p) => ({ ...p, [titleId]: true }));
      try {
        const { data } = await axios.post(
          `${API_BASE}/track/channel/${channelId}/title/${titleId}/sync-episode-status`,
          {},
          authHeaders()
        );
        toast.success(`Ep Status updated — Current: ${data.currentEpisode}`);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Ep Status update failed');
      } finally {
        setSyncingEpStatus((p) => ({ ...p, [titleId]: false }));
      }
    });
  };

  const jumpToTitleInChannel = (channelId: string, titleId: string, keyword: string) => {
    setSelectedChannelId(channelId);
    setShowAllTitles(false);
    openBrowseTitle(channelId, titleId, keyword);
    setTimeout(() => {
      document.getElementById(`titles-${channelId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const needsAttentionTotal = approvalPendingCount + manualReviewCount + pausedOrErrorCount;

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-sky-500/20 blur-xl" />
          <div className="relative">{Icon.spinner('w-10 h-10 text-sky-400')}</div>
        </div>
        <p className="text-xs text-slate-500 font-medium tracking-wide">Loading track manager…</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Enlarged Thumbnail Viewer */}
      {enlargedVideoId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setEnlargedVideoId(null)}
        >
          <button
            onClick={() => setEnlargedVideoId(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition backdrop-blur"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <HighResThumb videoId={enlargedVideoId} />
          </div>
        </div>
      )}

      {/* Channel delete confirmation modal */}
      {channelDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950/40 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-red-500/25 to-red-600/10 rounded-2xl border border-red-500/30">
                  {Icon.trash('w-5 h-5 text-red-300')}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Remove Channel</h3>
                  <p className="text-[11px] text-slate-500 font-medium">This action is permanent</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                <span className="text-white font-semibold">"{channelDeleteConfirm.channelName}"</span> and all its tracked titles will be
                permanently removed. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setChannelDeleteConfirm(null)}
                  disabled={deletingChannel}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold transition disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteChannel}
                  disabled={deletingChannel}
                  className="px-4 py-2.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-50 rounded-xl text-white font-bold transition shadow-lg shadow-red-600/30 flex items-center gap-2 text-sm"
                >
                  {deletingChannel && Icon.spinner('w-3.5 h-3.5')}
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification delete/undo/clear confirmation modal */}
      {notificationDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950/40 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-red-500/25 to-red-600/10 rounded-2xl border border-red-500/30">
                  {Icon.trash('w-5 h-5 text-red-300')}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {notificationDeleteConfirm.isBulk ? 'Remove All' : 'Remove Update'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">This action is permanent</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                {notificationDeleteConfirm.isBulk ? (
                  <>
                    <span className="text-white font-semibold">{notificationDeleteConfirm.count}</span> updates will be permanently removed. This
                    action cannot be undone.
                  </>
                ) : (
                  <>
                    <span className="text-white font-semibold">"{notificationDeleteConfirm.title}"</span> this update will be permanently removed.
                    This action cannot be undone.
                  </>
                )}
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setNotificationDeleteConfirm(null)}
                  disabled={deletingNotification}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-semibold transition disabled:opacity-50 text-sm"
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
                  className="px-4 py-2.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-50 rounded-xl text-white font-bold transition shadow-lg shadow-red-600/30 flex items-center gap-2 text-sm"
                >
                  {deletingNotification && Icon.spinner('w-3.5 h-3.5')}
                  {notificationDeleteConfirm.notificationId.startsWith('undo-') ? 'Undo' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-500/[0.07] via-transparent to-sky-500/[0.05] border border-white/10 rounded-3xl p-5 sm:p-6">
        <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-500/25 to-red-600/10 border border-red-500/30 shadow-lg shadow-red-500/10 flex-shrink-0">
            {Icon.youtube('w-7 h-7 text-red-400')}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">YouTube Track Manager</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Select channels and series — get notified as soon as a new episode is uploaded.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:shadow-xl hover:shadow-black/20">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-red-500/5 blur-2xl group-hover:bg-red-500/10 transition" />
          <div className="relative p-3 bg-gradient-to-br from-red-500/20 to-red-600/5 rounded-xl border border-red-500/25 flex-shrink-0">
            {Icon.youtube('w-5 h-5 text-red-300')}
          </div>
          <div className="relative">
            <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{channels.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Total Channels</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:shadow-xl hover:shadow-black/20">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-sky-500/5 blur-2xl group-hover:bg-sky-500/10 transition" />
          <div className="relative p-3 bg-gradient-to-br from-sky-500/20 to-sky-600/5 rounded-xl border border-sky-500/25 flex-shrink-0">
            {Icon.eye('w-5 h-5 text-sky-300')}
          </div>
          <div className="relative">
            <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{allTitlesFlat.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Total Tracked Titles</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:shadow-xl hover:shadow-black/20">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition" />
          <div className="relative p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 rounded-xl border border-emerald-500/25 flex-shrink-0">
            {Icon.bell('w-5 h-5 text-emerald-300')}
          </div>
          <div className="relative">
            <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{todayUpdatesCount}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Today's Updates</p>
          </div>
        </div>
      </div>

      {/* Capacity Meters — only for super‑admin */}
      {!isSubAdminContext && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <div className="flex justify-between items-baseline text-xs mb-2.5">
              <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Channels Tracked</span>
              <span className="text-slate-100 font-bold tabular-nums">
                {capacity.channelsUsed}
                <span className="text-slate-500 font-medium"> / {capacity.channelsLimit}</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden ring-1 ring-white/5">
              <div
                className="h-full bg-gradient-to-r from-slate-300 to-white/80 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                style={{ width: `${channelPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium tabular-nums">
              {channelPercent.toFixed(1)}% used
            </p>
          </div>
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <div className="flex justify-between items-baseline text-xs mb-2.5">
              <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">YouTube API Units (per cycle)</span>
              <span className="text-sky-300 font-bold tabular-nums">
                {capacity.unitsUsedPerCheck}
                <span className="text-slate-500 font-medium"> / {capacity.unitsLimit}</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden ring-1 ring-white/5">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                style={{ width: `${unitsPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium tabular-nums">
              {unitsPercent.toFixed(1)}% used
            </p>
          </div>
        </div>
      )}

      {/* Needs Attention widget */}
      {needsAttentionTotal > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/[0.06] to-transparent backdrop-blur-xl border border-amber-500/20 rounded-2xl p-4">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3.5">
              <span className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
                {Icon.warn('w-4 h-4 text-amber-400')}
              </span>
              <h4 className="text-xs font-bold text-amber-100 uppercase tracking-wider">
                Needs Attention
              </h4>
              <span className="text-[10px] text-slate-500 font-bold ml-auto tabular-nums">
                {needsAttentionTotal} item{needsAttentionTotal !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => setShowAllTitles(true)}
                className="group text-left rounded-xl p-3 bg-white/[0.03] hover:bg-amber-500/[0.08] border border-white/5 hover:border-amber-500/30 transition-all duration-150"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-amber-400">{Icon.clock('w-3.5 h-3.5')}</span>
                  <span className="text-[10px] text-slate-500 group-hover:text-amber-300 font-bold uppercase tracking-wider">
                    Approval
                  </span>
                </div>
                <p className="text-xl font-extrabold text-slate-100 group-hover:text-amber-200 leading-none tabular-nums transition">
                  {approvalPendingCount}
                </p>
              </button>

              <button
                onClick={() => setShowGlobalFeed(true)}
                className="group text-left rounded-xl p-3 bg-white/[0.03] hover:bg-orange-500/[0.08] border border-white/5 hover:border-orange-500/30 transition-all duration-150"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-orange-400/80">{Icon.bell('w-3.5 h-3.5')}</span>
                  <span className="text-[10px] text-slate-500 group-hover:text-orange-300 font-bold uppercase tracking-wider">
                    Review
                  </span>
                </div>
                <p className="text-xl font-extrabold text-slate-100 group-hover:text-orange-200 leading-none tabular-nums transition">
                  {manualReviewCount}
                </p>
              </button>

              <div className="text-left rounded-xl p-3 bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-red-400/80">{Icon.ban('w-3.5 h-3.5')}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Paused
                  </span>
                </div>
                <p className="text-xl font-extrabold text-slate-100 leading-none tabular-nums">
                  {pausedOrErrorCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified row: Conflicts | All Updates | All Titles */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => {
              setShowConflicts((v) => !v);
              if (!showConflicts) {
                setShowGlobalFeed(false);
                setShowAllTitles(false);
              }
            }}
            className={`group cursor-pointer relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border rounded-2xl transition-all duration-200 ${
              showConflicts
                ? 'border-amber-500/40 shadow-xl shadow-amber-500/5'
                : 'border-white/10 hover:border-amber-500/25'
            }`}
          >
            {showConflicts && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            )}
            <div className="relative w-full flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <span
                  className={`p-1.5 rounded-lg border transition ${
                    showConflicts
                      ? 'bg-amber-500/20 border-amber-500/30'
                      : 'bg-white/5 border-white/10 group-hover:bg-amber-500/10 group-hover:border-amber-500/20'
                  }`}
                >
                  {Icon.conflict('w-4 h-4 text-amber-300')}
                </span>
                <span>Conflicts</span>
                {conflicts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold tabular-nums">
                    {conflicts.length}
                  </span>
                )}
              </div>
              <span
                className={`text-slate-500 group-hover:text-amber-300 transition-all duration-200 ${
                  showConflicts ? 'rotate-180 text-amber-300' : ''
                }`}
              >
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setShowGlobalFeed((v) => !v);
              if (!showGlobalFeed) {
                setShowConflicts(false);
                setShowAllTitles(false);
              }
            }}
            className={`group cursor-pointer relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border rounded-2xl transition-all duration-200 ${
              showGlobalFeed
                ? 'border-rose-500/40 shadow-xl shadow-rose-500/5'
                : 'border-white/10 hover:border-rose-500/25'
            }`}
          >
            {showGlobalFeed && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/60 to-transparent" />
            )}
            <div className="relative w-full flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <span
                  className={`p-1.5 rounded-lg border transition ${
                    showGlobalFeed
                      ? 'bg-rose-500/20 border-rose-500/30'
                      : 'bg-white/5 border-white/10 group-hover:bg-rose-500/10 group-hover:border-rose-500/20'
                  }`}
                >
                  {Icon.bell('w-4 h-4 text-rose-300')}
                </span>
                <span>All Updates</span>
                {globalUnreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30 font-bold tabular-nums">
                    {globalUnreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-slate-500 group-hover:text-rose-300 transition-all duration-200 ${
                  showGlobalFeed ? 'rotate-180 text-rose-300' : ''
                }`}
              >
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setShowAllTitles((v) => !v);
              if (showAllTitles) closeBrowseTitle();
              if (!showAllTitles) {
                setShowConflicts(false);
                setShowGlobalFeed(false);
              }
            }}
            className={`group cursor-pointer relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border rounded-2xl transition-all duration-200 ${
              showAllTitles
                ? 'border-sky-500/40 shadow-xl shadow-sky-500/5'
                : 'border-white/10 hover:border-sky-500/25'
            }`}
          >
            {showAllTitles && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
            )}
            <div className="relative w-full flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <span
                  className={`p-1.5 rounded-lg border transition ${
                    showAllTitles
                      ? 'bg-sky-500/20 border-sky-500/30'
                      : 'bg-white/5 border-white/10 group-hover:bg-sky-500/10 group-hover:border-sky-500/20'
                  }`}
                >
                  {Icon.eye('w-4 h-4 text-sky-300')}
                </span>
                <span>All Titles</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-bold tabular-nums">
                  {allTitlesFlat.length}
                </span>
              </div>
              <span
                className={`text-slate-500 group-hover:text-sky-300 transition-all duration-200 ${
                  showAllTitles ? 'rotate-180 text-sky-300' : ''
                }`}
              >
                {Icon.chevron('w-4 h-4')}
              </span>
            </div>
          </div>
        </div>

        {showConflicts && (
          <div className="mt-3 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto">
            {conflicts.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
                  {Icon.checkAll('w-5 h-5 text-emerald-400')}
                </div>
                <p className="text-sm text-slate-400 font-medium">No conflicts detected</p>
                <p className="text-[11px] text-slate-600 mt-1">Everything is running smoothly</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {conflicts.map((cf) => (
                  <div
                    key={cf.pageId}
                    className="bg-gradient-to-br from-amber-500/[0.06] to-transparent border border-amber-500/25 rounded-xl p-3.5"
                  >
                    <p className="text-xs font-bold text-amber-200 mb-2.5 flex items-center gap-2">
                      <span className="p-1 rounded bg-amber-500/20 border border-amber-500/30">
                        {Icon.file('w-3 h-3 text-amber-300')}
                      </span>
                      <span className="truncate">{cf.slug}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 tabular-nums">
                        {cf.titles.length}
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {cf.titles.map((t) => (
                        <div
                          key={`${t.channelId}-${t.titleId}`}
                          className="flex items-center justify-between text-[11px] bg-black/30 rounded-lg px-2.5 py-2 border border-white/5"
                        >
                          <span className="text-slate-300 truncate">
                            <span className="text-white font-semibold">"{t.keyword}"</span>{' '}
                            <span className="text-slate-500">· {t.channelName}</span>
                          </span>
                          <button
                            onClick={() => setSelectedChannelId(t.channelId)}
                            className="text-sky-300 hover:text-sky-200 text-[10px] flex-shrink-0 ml-2 px-2 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition font-semibold"
                          >
                            Open
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
          <TrackNotificationsPanel
            notifications={notifications}
            showAllUpdates={showAllUpdatesGlobal}
            setShowAllUpdates={setShowAllUpdatesGlobal}
            globalUnreadCount={globalUnreadCount}
            markAllDoneInList={markAllDoneInList}
            deleteAllInList={deleteAllInList}
            markDone={markDone}
            deleteNotification={deleteNotification}
            shareVideo={shareVideo}
            resolveSeasonChange={resolveSeasonChange}
            undoNotification={undoNotification}
            undoing={undoing}
            channels={channels}
            openBrowseTitle={openBrowseTitle}
            closeBrowseTitle={closeBrowseTitle}
            setNotificationDeleteConfirm={setNotificationDeleteConfirm}
            setEnlargedVideoId={setEnlargedVideoId}
            setSelectedChannelId={setSelectedChannelId}
            animeOptions={animeOptions}
            browsingTitle={browsingTitle}
            browseData={browseData}
            browseLoading={browseLoading}
            selectedVideoIds={selectedVideoIds}
            episodeOverrides={episodeOverrides}
            setEpisodeOverrides={setEpisodeOverrides}
            toggleVideoSelect={toggleVideoSelect}
            selectAllVideos={selectAllVideos}
            doBulkAdd={doBulkAdd}
            bulkIgnoreSelected={bulkIgnoreSelected}
            finalizeApproval={finalizeApproval}
            ignoreVideo={ignoreVideo}
            expandedInfoId={expandedInfoId}
            setExpandedInfoId={setExpandedInfoId}
            scanBrowseDeeper={scanBrowseDeeper}
            setBulkAnimeId={setBulkAnimeId}
            setBulkPageId={setBulkPageId}
            fetchBulkPages={fetchBulkPages}
            bulkAnimeId={bulkAnimeId}
            bulkPageId={bulkPageId}
            bulkPages={bulkPages}
            finalizing={finalizing}
            bulkIgnoring={bulkIgnoring}
          />
        )}

        {showAllTitles && (
          <div
            className={`mt-3 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-xl border border-white/10 rounded-2xl p-4 overflow-y-auto ${
              browsingTitle ? 'max-h-[85vh]' : 'max-h-[500px]'
            }`}
          >
            <div className="relative mb-3.5">
              {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2')}
              <input
                value={allTitlesSearch}
                onChange={(e) => setAllTitlesSearch(e.target.value)}
                placeholder="Search title, anime or channel..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition"
              />
            </div>

            <div className="space-y-2">
              {filteredAllTitles.length === 0 ? (
                <div className="text-center py-10 bg-black/20 rounded-xl border border-dashed border-white/10">
                  <p className="text-sm text-slate-500">
                    {allTitlesSearch ? 'No title found' : 'No titles tracked yet'}
                  </p>
                </div>
              ) : (
                filteredAllTitles.map((t: any) => {
                  const linkedAnime = t.linkedAnimeId ? animeOptions.find((a) => a._id === t.linkedAnimeId) : null;
                  const isLinked = !!t.linkedAnimeId;
                  const isOpen = browsingTitle?.channelId === t.channelId && browsingTitle?.titleId === t.id;

                  return (
                    <div
                      key={`${t.channelId}-${t.id}`}
                      className={`rounded-xl border transition-all duration-150 ${
                        isOpen
                          ? 'border-sky-500/30 bg-gradient-to-br from-sky-500/[0.06] to-transparent shadow-lg shadow-sky-500/5'
                          : 'border-white/5 hover:border-white/15'
                      }`}
                    >
                      <button
                        onClick={() => toggleTitleInline(t)}
                        className="w-full flex items-center justify-between bg-black/20 hover:bg-black/30 rounded-xl px-3 py-2.5 text-left transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isLinked ? (
                            linkedAnime?.thumbnail ? (
                              <img
                                src={linkedAnime.thumbnail}
                                alt=""
                                className="w-10 h-14 object-cover rounded-lg flex-shrink-0 ring-1 ring-white/10 shadow-md"
                              />
                            ) : (
                              <div className="w-10 h-14 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10 text-slate-600">
                                {Icon.file('w-4 h-4')}
                              </div>
                            )
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
                              {t.channelThumbnail ? (
                                <img src={t.channelThumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-slate-300">
                                  {t.channelName?.charAt(0).toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs text-white font-bold truncate">{t.keyword}</p>
                            {isLinked ? (
                              <p className="text-[10px] text-sky-300 truncate flex items-center gap-1 mt-1">
                                {Icon.file('w-2.5 h-2.5 flex-shrink-0')}
                                <span className="truncate font-medium">{linkedAnime?.title || 'Linked Anime'}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-600 mt-1 font-medium">Not linked</p>
                            )}
                            <p className="text-[9px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              {isLinked && t.channelThumbnail && (
                                <img
                                  src={t.channelThumbnail}
                                  alt=""
                                  className="w-3 h-3 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
                                />
                              )}
                              <span className="truncate">
                                {t.channelName} · part <span className="tabular-nums">{t.lastKnownPart}</span>
                              </span>
                              {t.initialized === false && (
                                <span className="text-amber-400 flex-shrink-0">{Icon.clock('w-2.5 h-2.5')}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-slate-500 flex-shrink-0 ml-2 p-1.5 rounded-lg transition-all duration-200 ${
                            isOpen ? 'rotate-90 text-sky-400 bg-sky-500/10' : 'hover:bg-white/5'
                          }`}
                        >
                          {Icon.chevronRight('w-3.5 h-3.5')}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-2.5 pb-2.5 pt-2.5 space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isLinked && t.linkedDownloadPageId && (
                              <>
                                <button
                                  onClick={() => syncTitleWithPage(t.channelId, t.id)}
                                  disabled={!!syncingPage[t.id]}
                                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition disabled:opacity-50 flex items-center gap-1 font-semibold"
                                >
                                  {syncingPage[t.id] && Icon.spinner('w-3 h-3')}{' '}
                                  {syncingPage[t.id] ? 'Syncing...' : 'Sync'}
                                </button>
                                <button
                                  onClick={() => syncTitleEpisode(t.channelId, t.id)}
                                  disabled={!!syncingEpStatus[t.id]}
                                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50 flex items-center gap-1 font-semibold"
                                >
                                  {syncingEpStatus[t.id] && Icon.spinner('w-3 h-3')}{' '}
                                  {syncingEpStatus[t.id] ? 'Updating...' : 'Update Ep'}
                                </button>
                                <button
                                  onClick={() => unlinkTitle(t.channelId, t.id)}
                                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition font-semibold"
                                >
                                  Unlink
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => jumpToTitleInChannel(t.channelId, t.id, t.keyword)}
                              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition sm:ml-auto font-semibold"
                              title="Edit link / edit title / more options"
                            >
                              More options (channel)
                            </button>
                          </div>

                          <TrackTitleBrowsePanel
                            browseData={browseData}
                            browseLoading={browseLoading}
                            selectedVideoIds={selectedVideoIds}
                            episodeOverrides={episodeOverrides}
                            setEpisodeOverrides={setEpisodeOverrides}
                            toggleVideoSelect={toggleVideoSelect}
                            selectAllVideos={selectAllVideos}
                            doBulkAdd={doBulkAdd}
                            bulkIgnoreSelected={bulkIgnoreSelected}
                            finalizeApproval={finalizeApproval}
                            ignoreVideo={ignoreVideo}
                            expandedInfoId={expandedInfoId}
                            setExpandedInfoId={setExpandedInfoId}
                            scanBrowseDeeper={scanBrowseDeeper}
                            closeBrowseTitle={closeBrowseTitle}
                            setEnlargedVideoId={setEnlargedVideoId}
                            animeOptions={animeOptions}
                            bulkAnimeId={bulkAnimeId}
                            bulkPageId={bulkPageId}
                            setBulkPageId={setBulkPageId}
                            fetchBulkPages={fetchBulkPages}
                            bulkPages={bulkPages}
                            finalizing={finalizing}
                            bulkIgnoring={bulkIgnoring}
                            quickApproveSequential={quickApproveSequential}
                            isSequentialLowRisk={isSequentialLowRisk}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tracked Channels panel */}
      <TrackChannelsPanel
        channels={channels}
        capacity={capacity}
        selectedChannelId={selectedChannelId}
        setSelectedChannelId={setSelectedChannelId}
        notifications={notifications}
        animeOptions={animeOptions}
        pagesForAnime={pagesForAnime}
        fetchPagesForAnime={fetchPagesForAnime}
        addChannel={addChannel}
        removeChannel={removeChannel}
        refreshChannelInfo={refreshChannelInfo}
        togglePause={togglePause}
        checkNow={checkNow}
        addTitle={addTitle}
        addBulkTitles={addBulkTitles}
        removeTitle={removeTitle}
        saveEditTitle={saveEditTitle}
        openLinkForm={openLinkForm}
        closeLinkForm={closeLinkForm}
        saveLinkForm={saveLinkForm}
        unlinkTitle={unlinkTitle}
        openBrowseTitle={openBrowseTitle}
        closeBrowseTitle={closeBrowseTitle}
        newHandle={newHandle}
        setNewHandle={setNewHandle}
        adding={adding}
        checkingNow={checkingNow}
        togglingPause={togglingPause}
        refreshingInfo={refreshingInfo}
        syncingPage={syncingPage}
        syncingEpStatus={syncingEpStatus}
        showChannelFeed={showChannelFeed}
        setShowChannelFeed={setShowChannelFeed}
        markAllDoneInList={markAllDoneInList}
        deleteAllInList={deleteAllInList}
        showAllUpdates={showAllUpdates}
        setShowAllUpdates={setShowAllUpdates}
        markDone={markDone}
        deleteNotification={deleteNotification}
        shareVideo={shareVideo}
        resolveSeasonChange={resolveSeasonChange}
        undoNotification={undoNotification}
        undoing={undoing}
        setNotificationDeleteConfirm={setNotificationDeleteConfirm}
        setEnlargedVideoId={setEnlargedVideoId}
        browsingTitle={browsingTitle}
        browseData={browseData}
        browseLoading={browseLoading}
        selectedVideoIds={selectedVideoIds}
        episodeOverrides={episodeOverrides}
        setEpisodeOverrides={setEpisodeOverrides}
        toggleVideoSelect={toggleVideoSelect}
        selectAllVideos={selectAllVideos}
        doBulkAdd={doBulkAdd}
        bulkIgnoreSelected={bulkIgnoreSelected}
        finalizeApproval={finalizeApproval}
        ignoreVideo={ignoreVideo}
        expandedInfoId={expandedInfoId}
        setExpandedInfoId={setExpandedInfoId}
        scanBrowseDeeper={scanBrowseDeeper}
        setBulkAnimeId={setBulkAnimeId}
        setBulkPageId={setBulkPageId}
        fetchBulkPages={fetchBulkPages}
        bulkAnimeId={bulkAnimeId}
        bulkPageId={bulkPageId}
        bulkPages={bulkPages}
        finalizing={finalizing}
        bulkIgnoring={bulkIgnoring}
        previewForChannel={previewForChannel}
        setPreviewForChannel={setPreviewForChannel}
        previewLoading={previewLoading}
        previewResults={previewResults}
        previewSelectedIds={previewSelectedIds}
        togglePreviewVideoSelect={togglePreviewVideoSelect}
        selectAllPreviewVideos={selectAllPreviewVideos}
        previewEpisodeOverrides={previewEpisodeOverrides}
        setPreviewEpisodeOverrides={setPreviewEpisodeOverrides}
        previewBulkAnimeId={previewBulkAnimeId}
        setPreviewBulkAnimeId={setPreviewBulkAnimeId}
        previewBulkPageId={previewBulkPageId}
        setPreviewBulkPageId={setPreviewBulkPageId}
        previewBulkPages={previewBulkPages}
        fetchPreviewBulkPages={fetchPreviewBulkPages}
        doPreviewBulkAdd={doPreviewBulkAdd}
        previewAdding={previewAdding}
        scanPreviewDeeper={scanPreviewDeeper}
        runPreview={runPreview}
        previewScanDepth={previewScanDepth}
        setPreviewScanDepth={setPreviewScanDepth}
        titleInputs={titleInputs}
        setTitleInputs={setTitleInputs}
        excludeKeywordsInputs={excludeKeywordsInputs}
        setExcludeKeywordsInputs={setExcludeKeywordsInputs}
        matchThresholdInputs={matchThresholdInputs}
        setMatchThresholdInputs={setMatchThresholdInputs}
        quickExcludes={quickExcludes}
        addToExclude={addToExclude}
        bulkModeChannel={bulkModeChannel}
        setBulkModeChannel={setBulkModeChannel}
        bulkText={bulkText}
        setBulkText={setBulkText}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        editKeyword={editKeyword}
        setEditKeyword={setEditKeyword}
        editLastPart={editLastPart}
        setEditLastPart={setEditLastPart}
        cancelEditTitle={cancelEditTitle}
        linkFormTitleId={linkFormTitleId}
        setLinkFormTitleId={setLinkFormTitleId}
        linkAnimeId={linkAnimeId}
        setLinkAnimeId={setLinkAnimeId}
        linkPageId={linkPageId}
        setLinkPageId={setLinkPageId}
        linkLimit={linkLimit}
        setLinkLimit={setLinkLimit}
        linkMergeMode={linkMergeMode}
        setLinkMergeMode={setLinkMergeMode}
        linkBaselineMin={linkBaselineMin}
        setLinkBaselineMin={setLinkBaselineMin}
        savingLink={savingLink}
        quickApproveSequential={quickApproveSequential}
        isSequentialLowRisk={isSequentialLowRisk}
        linkStrictChronology={linkStrictChronology}
        setLinkStrictChronology={setLinkStrictChronology}
        linkChronologyFloorDate={linkChronologyFloorDate}
        setLinkChronologyFloorDate={setLinkChronologyFloorDate}
        linkChronologyGraceGap={linkChronologyGraceGap}
        setLinkChronologyGraceGap={setLinkChronologyGraceGap}
        isSubAdmin={isSubAdminContext}
        previewProgress={previewProgress}
        cancelPreview={cancelPreview}
      />

      {/* Run History + Check Logs */}
      <TrackListLogs
        logs={logs}
        showLogs={showLogs}
        setShowLogs={setShowLogs}
        clearAllLogs={clearAllLogs}
        clearingLogs={clearingLogs}
        runs={runs}
        showRunHistory={showRunHistory}
        setShowRunHistory={setShowRunHistory}
        runAllNow={runAllNow}
        runningAll={runningAll}
        clearAllRuns={clearAllRuns}
        clearingRuns={clearingRuns}
        isSubAdmin={isSubAdminContext}
      />
    </div>
  );
};

export default TrackListManager;