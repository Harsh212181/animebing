 // src/components/admin/TrackListManager.tsx
import React, { useState, useEffect } from 'react';
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
import TrackChannelsPanel from './TrackChannelsPanel';
import TrackListLogs from './TrackListLogs';
import TrackNotificationsPanel from './TrackNotificationsPanel';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

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
  const [showAllUpdates, setShowAllUpdates] = useState(false); // per-channel feed toggle
  const [bulkModeChannel, setBulkModeChannel] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [showAllUpdatesGlobal, setShowAllUpdatesGlobal] = useState(false); // global feed toggle

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

  const clearAllLogs = () => {
    setNotificationDeleteConfirm({
      notificationId: 'all-logs',
      count: logs.length,
      isBulk: true,
      title: 'All Check Logs',
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

  const clearAllRuns = () => {
    setNotificationDeleteConfirm({
      notificationId: 'all-runs',
      count: runs.length,
      isBulk: true,
      title: 'All Run History',
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
    setRefreshingInfo((prev) => ({ ...prev, [channelId]: true }));
    try {
      await axios.post(`${API_BASE}/track/channel/${channelId}/refresh-info`, {}, authHeaders());
      toast.success('Logo/naam update ho gaya');
      loadData();
    } catch {
      toast.error('Refresh nahi ho saka');
    } finally {
      setRefreshingInfo((prev) => ({ ...prev, [channelId]: false }));
    }
  };

  const togglePause = async (channelId: string) => {
    setTogglingPause((prev) => ({ ...prev, [channelId]: true }));
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/toggle-pause`, {}, authHeaders());
      toast.success(data.paused ? 'Channel pause ho gaya' : 'Channel resume ho gaya (error counter reset)');
      loadData();
    } catch {
      toast.error('Pause/Resume fail ho gaya');
    } finally {
      setTogglingPause((prev) => ({ ...prev, [channelId]: false }));
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

  // ============ PREVIEW ============
  const runPreview = async (channelId: string, depth?: number) => {
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword) {
      toast.error('Pehle keyword likho, fir Preview dabao');
      return;
    }
    const excludeKeywords = (excludeKeywordsInputs[channelId] || '').split(',').map((s) => s.trim()).filter(Boolean);
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
    const keyword = titleInputs[channelId]?.trim();
    if (!keyword || !previewBulkPageId || previewSelectedIds.size === 0) return;
    setPreviewAdding(true);
    try {
      const overridesToSend: Record<string, string> = {};
      for (const vid of previewSelectedIds) {
        const raw = previewEpisodeOverrides[vid];
        if (raw !== undefined && raw.trim() !== '') {
          overridesToSend[vid] = raw.trim();
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
  const addTitle = async (channelId: string, keyword: string, excludeKeywords: string[]) => {
    const kw = keyword.trim();
    if (!kw) return;
    try {
      await axios.post(`${API_BASE}/track/channel/${channelId}/title/add`, { keyword: kw, currentKnownPart: 0, excludeKeywords }, authHeaders());
      toast.success(`"${kw}" add ho gaya`);
      setTitleInputs({ ...titleInputs, [channelId]: '' });
      setExcludeKeywordsInputs({ ...excludeKeywordsInputs, [channelId]: '' });
      setPreviewResults(null);
      setPreviewForChannel(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Title add nahi ho saka');
    }
  };

  const addBulkTitles = async (channelId: string, bulkTextValue: string) => {
    const lines = bulkTextValue.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    try {
      const { data } = await axios.post(`${API_BASE}/track/channel/${channelId}/title/bulk-add`, { keywords: lines }, authHeaders());
      toast.success(`${data.added} titles add ho gaye${data.skipped?.length ? `, ${data.skipped.length} pehle se the` : ''}`);
      setBulkText('');
      setBulkModeChannel(null);
      loadData();
    } catch {
      toast.error('Bulk add me kuch fail ho gaya');
    }
  };

  const cancelEditTitle = () => {
    setEditingTitle(null);
    setEditKeyword('');
    setEditLastPart('');
  };

  const saveEditTitle = async (channelId: string, titleId: string, keyword: string, lastPart: number) => {
    try {
      await axios.put(
        `${API_BASE}/track/channel/${channelId}/title/${titleId}/edit`,
        { keyword: keyword.trim(), lastKnownPart: lastPart || 0 },
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
  const allTitlesFlat = channels.flatMap((ch) =>
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
      toast.success(`${data.added} episodes add ho gaye!`);
      setSelectedVideoIds(new Set());
      setEpisodeOverrides({});
      openBrowseTitle(browsingTitle.channelId, browsingTitle.titleId, browsingTitle.keyword);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Add nahi ho saka');
    } finally {
      setFinalizing(false);
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

  const deleteAllInList = (list: TrackNotification[]) => {
    if (list.length === 0) return;
    setNotificationDeleteConfirm({
      notificationId: 'bulk-notifications',
      count: list.length,
      isBulk: true,
      title: 'All Notifications in this list',
    });
    // stash the list so confirmBulkDeleteNotifications knows exactly what to delete
    pendingBulkDeleteRef.current = list;
  };

  // ref-like holder for whichever list "deleteAllInList" was called with (channel feed or global feed)
  const pendingBulkDeleteRef = React.useRef<TrackNotification[]>([]);

  const confirmBulkDeleteNotifications = async () => {
    if (!notificationDeleteConfirm || notificationDeleteConfirm.notificationId !== 'bulk-notifications') return;
    setDeletingNotification(true);
    try {
      const currentList = pendingBulkDeleteRef.current;
      await Promise.all(currentList.map((n) => axios.delete(`${API_BASE}/track/notifications/${n._id}`, authHeaders())));
      toast.success(`${currentList.length} updates remove ho gaye`);
      loadData();
    } catch {
      toast.error('Clear all fail ho gaya');
    } finally {
      setDeletingNotification(false);
      setNotificationDeleteConfirm(null);
      pendingBulkDeleteRef.current = [];
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
    const channel = channels.find((ch) => (ch.titles || []).some((t: any) => t.keyword === notif.titleKeyword));
    const title = channel?.titles.find((t: any) => t.keyword === notif.titleKeyword) as any;
    if (!title || !channel) {
      toast.error('Title/channel nahi mila');
      return;
    }
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
  const undoNotification = (n: TrackNotification) => {
    setNotificationDeleteConfirm({
      notificationId: `undo-${n._id}`,
      title: n.titleKeyword || n.channelName,
      isBulk: false,
    });
  };

  const confirmUndoNotification = async () => {
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
  const pendingGlobalNotifs = showAllUpdatesGlobal ? notifications : notifications.filter((n) => !n.isRead);
  const globalUnreadCount = notifications.filter((n) => !n.isRead).length;

  const todayUpdatesCount = notifications.filter((n) => {
    const notifDate = new Date(n.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return notifDate === todayDate;
  }).length;

  const channelPercent = Math.min(100, (capacity.channelsUsed / capacity.channelsLimit) * 100);
  const unitsPercent = Math.min(100, (capacity.unitsUsedPerCheck / capacity.unitsLimit) * 100);

  const quickExcludes = ['Sub', 'English Dub', 'Tamil dub', 'Telugu dub', 'English sub', 'Hindi dub', 'Tamil sub', 'Telugu sub', 'Preview', 'EN Sub'];

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

  // when a title is clicked from the global "All Titles" list, jump to its channel accordion + open its browse panel
  const jumpToTitleInChannel = (channelId: string, titleId: string, keyword: string) => {
    setSelectedChannelId(channelId);
    setShowAllTitles(false);
    openBrowseTitle(channelId, titleId, keyword);
    setTimeout(() => {
      document.getElementById(`titles-${channelId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        {Icon.spinner('w-8 h-8 text-slate-400')}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Enlarged Thumbnail Viewer */}
      {enlargedVideoId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setEnlargedVideoId(null)}
        >
          <button
            onClick={() => setEnlargedVideoId(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <HighResThumb videoId={enlargedVideoId} />
        </div>
      )}

      {/* Channel delete confirmation modal */}
      {channelDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/20 rounded-xl">{Icon.trash('w-5 h-5 text-red-300')}</div>
              <h3 className="text-lg font-bold text-white">Channel Remove Karo</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              <span className="text-white font-semibold">"{channelDeleteConfirm.channelName}"</span> aur uske saare tracked titles hamesha ke liye
              remove ho jayenge. Ye action wapas nahi ho sakta.
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

      {/* Notification delete/undo/clear confirmation modal */}
      {notificationDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/20 rounded-xl">{Icon.trash('w-5 h-5 text-red-300')}</div>
              <h3 className="text-lg font-bold text-white">
                {notificationDeleteConfirm.isBulk ? 'Sabhi Remove Karo' : 'Update Remove Karo'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              {notificationDeleteConfirm.isBulk ? (
                <>
                  <span className="text-white font-semibold">{notificationDeleteConfirm.count}</span> updates hamesha ke liye remove ho jayenge. Ye
                  action wapas nahi ho sakta.
                </>
              ) : (
                <>
                  <span className="text-white font-semibold">"{notificationDeleteConfirm.title}"</span> ka ye update hamesha ke liye remove ho
                  jayega. Ye action wapas nahi ho sakta.
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

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-red-500">{Icon.youtube('w-8 h-8')}</span>
        <div>
          <h3 className="text-xl font-bold text-white">YouTube Track Manager</h3>
          <p className="text-sm text-slate-400 mt-0.5">Channels aur series select karo – naye episode upload hote hi notification milegi.</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl">{Icon.youtube('w-5 h-5 text-slate-300')}</div>
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

      {/* Capacity Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Channels Tracked</span>
            <span className="text-slate-200 font-semibold">
              {capacity.channelsUsed} / {capacity.channelsLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full bg-white/40 rounded-full transition-all duration-500" style={{ width: `${channelPercent}%` }} />
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
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showConflicts ? 'ring-2 ring-amber-500/50' : ''
            }`}
          >
            <div
              className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
                showConflicts ? 'bg-amber-500/10 border-b border-amber-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.conflict('w-4 h-4 text-amber-300')}
                <span>Conflicts</span>
                {conflicts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    {conflicts.length}
                  </span>
                )}
              </div>
              <span className={`text-slate-400 transition-transform ${showConflicts ? 'rotate-180' : ''}`}>{Icon.chevron('w-4 h-4')}</span>
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
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showGlobalFeed ? 'ring-2 ring-rose-500/50' : ''
            }`}
          >
            <div
              className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
                showGlobalFeed ? 'bg-rose-500/10 border-b border-rose-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.bell('w-4 h-4 text-rose-300')}
                <span>All Updates</span>
                {globalUnreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                    {globalUnreadCount}
                  </span>
                )}
              </div>
              <span className={`text-slate-400 transition-transform ${showGlobalFeed ? 'rotate-180' : ''}`}>{Icon.chevron('w-4 h-4')}</span>
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
            className={`cursor-pointer bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
              showAllTitles ? 'ring-2 ring-sky-500/50' : ''
            }`}
          >
            <div
              className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition ${
                showAllTitles ? 'bg-sky-500/10 border-b border-sky-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {Icon.eye('w-4 h-4 text-sky-300')}
                <span>All Titles</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-semibold">
                  {allTitlesFlat.length}
                </span>
              </div>
              <span className={`text-slate-400 transition-transform ${showAllTitles ? 'rotate-180' : ''}`}>{Icon.chevron('w-4 h-4')}</span>
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
                            className="text-slate-300 hover:text-white underline text-[10px] flex-shrink-0 ml-2"
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
          <div className="mt-3 bg-slate-800/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
            <div className="relative mb-3">
              {Icon.search('w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2')}
              <input
                value={allTitlesSearch}
                onChange={(e) => setAllTitlesSearch(e.target.value)}
                placeholder="Search title or channel..."
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="space-y-2">
              {filteredAllTitles.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">{allTitlesSearch ? 'No title found' : 'No titles tracked yet'}</p>
              ) : (
                filteredAllTitles.map((t: any) => (
                  <button
                    key={`${t.channelId}-${t.id}`}
                    onClick={() => jumpToTitleInChannel(t.channelId, t.id, t.keyword)}
                    className="w-full flex items-center justify-between bg-black/20 hover:bg-black/40 rounded-lg px-3 py-2 text-left transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {t.channelThumbnail ? (
                          <img src={t.channelThumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400">{t.channelName?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{t.keyword}</p>
                        <p className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                          <span>
                            {t.channelName} · part {t.lastKnownPart}
                          </span>
                          {t.initialized === false && <span className="text-amber-400">{Icon.clock('w-2.5 h-2.5')}</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-slate-500 flex-shrink-0 ml-2">{Icon.chevronRight('w-3.5 h-3.5')}</span>
                  </button>
                ))
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
      />
    </div>
  );
};

export default TrackListManager;