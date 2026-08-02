// src/components/admin/PollManager.tsx

import React, { useState, useEffect } from 'react';
import { Poll, CreatePollData, Anime } from '../../types';
import { toast } from 'react-hot-toast';
import {
  Search, X, Plus, Trash2, Eye, EyeOff, Calendar, Clock, Link,
  Edit2, Save, ChevronDown, ChevronUp, RefreshCw, AlertCircle,
  CheckCircle, Pencil, Copy, Download, BarChart3, Users, FileText,
  Smartphone, Tablet, Monitor, TrendingUp, Zap, Award, Image as ImageIcon, Eye as EyeIcon
} from 'lucide-react';

interface PollManagerProps {
  token: string;
  apiBase: string;
}

interface SavedCustomOption {
  title: string;
  image: string;
}

const CUSTOM_OPTIONS_STORAGE_KEY = 'pollManager_savedCustomOptions';

const formatDeviceType = (type?: string): string => {
  if (!type) return 'Unknown';
  const map: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'PC' };
  return map[type.toLowerCase()] || type;
};

const getDeviceIcon = (type?: string) => {
  const t = type?.toLowerCase();
  if (t === 'mobile') return <Smartphone size={13} />;
  if (t === 'tablet') return <Tablet size={13} />;
  return <Monitor size={13} />;
};

const truncate = (str: string, n: number) =>
  str.length > n ? str.slice(0, n) + '…' : str;

// Renders text with newlines preserved + clickable URLs (matches homepage PollCard rendering)
const renderMultilineText = (text: string): React.ReactNode[] => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts = line.split(urlRegex);
    return (
      <React.Fragment key={li}>
        {parts.map((part, i) =>
          part.match(urlRegex) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-words">
              {part}
            </a>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
        {li < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const PollManager: React.FC<PollManagerProps> = ({ token, apiBase }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [updatingPoll, setUpdatingPoll] = useState(false);
  const [newPoll, setNewPoll] = useState<CreatePollData>({ question: '', options: [], expiresAt: '' });
  const [availableAnime, setAvailableAnime] = useState<Anime[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAnime, setTotalAnime] = useState(0);
  const [hasMoreAnime, setHasMoreAnime] = useState(true);
  const [customOption, setCustomOption] = useState({ title: '', imageUrl: '' });
  const [viewMode, setViewMode] = useState<'create' | 'manage'>('manage');
  const [isEditing, setIsEditing] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);

  // ✅ NEW: tab switch between "Browse Anime" and "Custom Images", + infinite-scroll page size for custom images
  const [browseTab, setBrowseTab] = useState<'anime' | 'custom'>('anime');
  const [customVisibleCount, setCustomVisibleCount] = useState(30);
  const [loadingMoreAnime, setLoadingMoreAnime] = useState(false);
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const questionRef = React.useRef<HTMLTextAreaElement>(null);

  // ✅ NEW: previously used/saved custom options (persisted in localStorage)
  const [savedCustomOptions, setSavedCustomOptions] = useState<SavedCustomOption[]>([]);

  const loadSavedCustomOptions = () => {
    try {
      const raw = localStorage.getItem(CUSTOM_OPTIONS_STORAGE_KEY);
      setSavedCustomOptions(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedCustomOptions([]);
    }
  };

  const persistSavedCustomOptions = (list: SavedCustomOption[]) => {
    try { localStorage.setItem(CUSTOM_OPTIONS_STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/polls/admin/all`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      let pollsData: Poll[] = [];
      if (Array.isArray(data)) {
        pollsData = data.map((poll: any) => ({
          ...poll,
          isExpired: poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()),
          votersCount: poll.votersCount || poll.voters?.length || 0
        }));
      }
      setPolls(pollsData);
    } catch (err: any) {
      toast.error(`Failed to load polls: ${err.message}`);
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollDetails = async (pollId: string) => {
    try {
      const res = await fetch(`${apiBase}/polls/admin/${pollId}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      if (result.success && result.poll) {
        return { ...result.poll, votersCount: result.poll.votersCount || result.poll.voters?.length || 0 };
      }
    } catch { toast.error('Failed to load poll details'); }
    return null;
  };

  // ✅ FIX: expand instantly on click (no waiting for the network first), then quietly
  // refresh the poll's full data (voters/results) in the background. Uses the functional
  // form of setPolls so a slow earlier fetch can't overwrite a newer one (this was the
  // "have to click 2-3 times" bug — the button gave no feedback while awaiting the fetch,
  // and a stale `polls` closure could clobber fresher data when two fetches resolved out of order).
  const handleToggleDetails = async (poll: Poll) => {
    const pollId = poll._id;
    if (expandedPollId === pollId) {
      setExpandedPollId(null);
      return;
    }
    setExpandedPollId(pollId); // instant visual feedback
    setLoadingDetailsId(pollId);
    const detailed = await fetchPollDetails(pollId);
    if (detailed) {
      setPolls(prev => prev.map(p => (p._id === pollId ? detailed : p)));
    }
    setLoadingDetailsId(prev => (prev === pollId ? null : prev));
  };

  const fetchAnime = async (query = '', page = 1, limit = 50) => {
    try {
      if (page > 1) setLoadingMoreAnime(true);
      const url = query
        ? `${apiBase}/anime?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
        : `${apiBase}/anime?page=${page}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      let animeList: Anime[] = [];
      let total = 0;
      if (Array.isArray(data)) { animeList = data; total = data.length; }
      else if (data?.data) { animeList = data.data; total = data.total || data.data.length; }
      if (page === 1) setAvailableAnime(animeList);
      else setAvailableAnime(prev => [...prev, ...animeList]);
      setTotalAnime(total);
      setHasMoreAnime(animeList.length === limit);
      setCurrentPage(page);
    } catch { toast.error('Failed to load anime'); setAvailableAnime([]); }
    finally { setLoadingMoreAnime(false); }
  };

  useEffect(() => {
    if (browseTab !== 'anime') return; // custom images tab doesn't need the anime API
    const t = setTimeout(() => fetchAnime(searchQuery, 1, 50), 500);
    return () => clearTimeout(t);
  }, [searchQuery, browseTab]);

  // ✅ Reset how many custom images are visible whenever the search text or tab changes
  useEffect(() => {
    setCustomVisibleCount(30);
  }, [searchQuery, browseTab]);

  useEffect(() => {
    fetchPolls();
    fetchAnime('', 1, 50);
    loadSavedCustomOptions(); // ✅ load saved custom options on mount
  }, []);

  const addAnimeToOptions = (anime: Anime) => {
    if (selectedAnimeIds.includes(anime._id)) { toast.error('Already added'); return; }
    if (newPoll.options.length >= 10) { toast.error('Max 10 options'); return; }
    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, { animeId: anime._id, title: anime.title, image: anime.thumbnail || anime.posterImage || '' }]
    }));
    setSelectedAnimeIds(prev => [...prev, anime._id]);
  };

  // ✅ UPDATED: also saves the custom option to localStorage for future reuse
  const addCustomOption = () => {
    if (!customOption.title.trim()) { toast.error('Title required'); return; }
    if (!customOption.imageUrl.trim()) { toast.error('Image URL required'); return; }
    try { new URL(customOption.imageUrl); } catch { toast.error('Invalid URL'); return; }
    if (newPoll.options.length >= 10) { toast.error('Max 10 options'); return; }

    const title = customOption.title.trim();
    const image = customOption.imageUrl.trim();
    const id = `custom_${Date.now()}`;

    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, { animeId: id, title, image }]
    }));

    // Save for reuse next time (dedupe by title+image, newest first). Kept permanently —
    // even if the poll using it is later deleted, it stays here for reuse.
    setSavedCustomOptions(prev => {
      const withoutDup = prev.filter(o => !(o.title === title && o.image === image));
      const updated = [{ title, image }, ...withoutDup].slice(0, 1000);
      persistSavedCustomOptions(updated);
      return updated;
    });

    setCustomOption({ title: '', imageUrl: '' });
    toast.success('Added & saved for next time');
  };

  // ✅ NEW: quickly re-use a previously saved custom option
  const addSavedCustomOption = (opt: SavedCustomOption) => {
    if (newPoll.options.length >= 10) { toast.error('Max 10 options'); return; }
    const alreadyInPoll = newPoll.options.some(o => o.title === opt.title && o.image === opt.image);
    if (alreadyInPoll) { toast.error('Already added in this poll'); return; }
    const id = `custom_${Date.now()}`;
    setNewPoll(prev => ({ ...prev, options: [...prev.options, { animeId: id, title: opt.title, image: opt.image }] }));
  };

  // ✅ NEW: remove a saved custom option from the reusable list
  const removeSavedCustomOption = (opt: SavedCustomOption) => {
    setSavedCustomOptions(prev => {
      const updated = prev.filter(o => !(o.title === opt.title && o.image === opt.image));
      persistSavedCustomOptions(updated);
      return updated;
    });
  };

  const removeAnimeOption = (index: number) => {
    const updated = [...newPoll.options];
    const removed = updated.splice(index, 1)[0];
    setNewPoll(prev => ({ ...prev, options: updated }));
    if (removed?.animeId && !removed.animeId.startsWith('custom_'))
      setSelectedAnimeIds(prev => prev.filter(id => id !== removed.animeId));
  };

  const saveEditedTitle = (index: number) => {
    if (!editedTitle.trim()) return;
    const updated = [...newPoll.options];
    updated[index].title = editedTitle.trim();
    setNewPoll(prev => ({ ...prev, options: updated }));
    setEditingIndex(null);
  };

  const handleCreatePoll = async () => {
    if (!newPoll.question.trim() || newPoll.options.length < 4 || newPoll.options.length > 10 || !newPoll.expiresAt) return;
    try {
      setCreatingPoll(true);
      const res = await fetch(`${apiBase}/polls/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: newPoll.question.trim(), options: newPoll.options, expiresAt: new Date(newPoll.expiresAt).toISOString() })
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toast.success('Poll created!');
      resetForm(); setViewMode('manage'); fetchPolls();
    } catch (e: any) { toast.error(e.message); } finally { setCreatingPoll(false); }
  };

  const handleUpdatePoll = async () => {
    if (!editingPollId || !newPoll.question.trim() || newPoll.options.length < 4 || !newPoll.expiresAt) return;
    try {
      setUpdatingPoll(true);
      const res = await fetch(`${apiBase}/polls/admin/${editingPollId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: newPoll.question.trim(), options: newPoll.options, expiresAt: new Date(newPoll.expiresAt).toISOString() })
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toast.success('Updated!');
      resetForm(); setIsEditing(false); setViewMode('manage'); fetchPolls();
    } catch (e: any) { toast.error(e.message); } finally { setUpdatingPoll(false); }
  };

  const handleEditPoll = (poll: Poll) => {
    setEditingPollId(poll._id); setIsEditing(true);
    setNewPoll({
      question: poll.question,
      options: poll.options?.map(o => ({ animeId: o.animeId || '', title: o.title, image: o.image || '' })) || [],
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt).toISOString().slice(0, 16) : ''
    });
    setSelectedAnimeIds(poll.options?.filter(o => o.animeId && !o.animeId.startsWith('custom_')).map(o => o.animeId!) || []);
    setViewMode('create');
  };

  const handleDuplicatePoll = (poll: Poll) => {
    setNewPoll({
      question: `${poll.question} (Copy)`,
      options: poll.options?.map(o => ({ animeId: o.animeId || '', title: o.title, image: o.image || '' })) || [],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
    });
    setIsEditing(false); setViewMode('create');
  };

  const togglePollStatus = async (id: string) => {
    try {
      await fetch(`${apiBase}/polls/admin/${id}/toggle`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      fetchPolls();
    } catch { toast.error('Failed'); }
  };

  const deletePoll = async (id: string) => {
    if (!confirm('Delete this poll?')) return;
    try {
      await fetch(`${apiBase}/polls/admin/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      toast.success('Deleted');
      fetchPolls();
    } catch { toast.error('Failed'); }
  };

  const deleteExpiredPolls = async () => {
    if (!confirm('Delete all expired polls?')) return;
    try {
      const res = await fetch(`${apiBase}/polls/admin/cleanup/expired`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      toast.success(`Deleted ${result.deletedCount || 0} polls`);
      fetchPolls();
    } catch { toast.error('Failed'); }
  };

  const exportPollResults = (poll: Poll) => {
    const rows = [
      ['Question', poll.question], ['Total Votes', poll.totalVotes || 0], [''],
      ['Option', 'Votes', '%'],
      ...(poll.options || []).map(o => [o.title, o.votes || 0, poll.totalVotes ? ((o.votes || 0) / poll.totalVotes * 100).toFixed(1) + '%' : '0%'])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `poll-${poll._id}.csv`; a.click();
  };

  const exportVotersList = (poll: Poll) => {
    const voters = poll.voters as any[];
    if (!voters?.length) { toast.error('No voters'); return; }
    const rows = [['#', 'Device', 'Voted At', 'Voted For'],
      ...voters.map((v, i) => {
        const opt = poll.options?.find(o => o._id === v.optionId || o.animeId === v.optionId);
        return [i + 1, formatDeviceType(v.deviceType), v.votedAt ? new Date(v.votedAt).toLocaleString() : '', opt?.title || ''];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `voters-${poll._id}.csv`; a.click();
  };

  const resetForm = () => {
    setNewPoll({ question: '', options: [], expiresAt: '' });
    setSelectedAnimeIds([]); setCustomOption({ title: '', imageUrl: '' });
    setSearchQuery(''); setEditingIndex(null); setEditedTitle('');
    setEditingPollId(null); setIsEditing(false);
  };

  const isFormValid = !!(newPoll.question.trim() && newPoll.options.length >= 4 && newPoll.options.length <= 10 && newPoll.expiresAt && new Date(newPoll.expiresAt) > new Date());
  const activePolls = polls.filter(p => p.isActive && !p.isExpired && (!p.expiresAt || new Date(p.expiresAt) >= new Date()));
  const expiredPolls = polls.filter(p => p.isExpired || (p.expiresAt && new Date(p.expiresAt) < new Date()));
  const filteredPolls = showExpired ? expiredPolls : polls.filter(p => !p.isExpired && (!p.expiresAt || new Date(p.expiresAt) >= new Date()));

  // ✅ NEW: Custom Images tab helpers
  const switchBrowseTab = (tab: 'anime' | 'custom') => {
    setBrowseTab(tab);
    setCustomVisibleCount(30);
  };

  const filteredCustomOptions = savedCustomOptions.filter(o =>
    o.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const visibleCustomOptions = filteredCustomOptions.slice(0, customVisibleCount);

  const isCustomOptionInPoll = (opt: SavedCustomOption) =>
    newPoll.options.some(o => o.title === opt.title && o.image === opt.image);

  // Infinite scroll: jab grid ke bottom ke paas pahunche, aur 30 images load kar do
  const handleCustomGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setCustomVisibleCount(prev => (prev < filteredCustomOptions.length ? Math.min(prev + 30, filteredCustomOptions.length) : prev));
    }
  };

  // ✅ Anime grid infinite scroll — no "Load more" button, auto-fetches next page on scroll
  const handleAnimeGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!loadingMoreAnime && hasMoreAnime && el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      fetchAnime(searchQuery, currentPage + 1, 50);
    }
  };

  // ✅ NEW: Question list-style toolbar helpers (numbers, roman numerals, alphabets, bullets, arrows, stars)
  const toRoman = (num: number): string => {
    const map: [number, string][] = [
      [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
      [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
      [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    let result = '';
    for (const [value, sym] of map) { while (num >= value) { result += sym; num -= value; } }
    return result;
  };

  const toAlpha = (num: number): string => {
    let s = '';
    while (num > 0) {
      const rem = (num - 1) % 26;
      s = String.fromCharCode(97 + rem) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };

  const insertListPrefix = (style: 'number' | 'roman' | 'alpha' | 'bullet' | 'arrow' | 'star') => {
    const el = questionRef.current;
    const question = newPoll.question;
    const start = el ? el.selectionStart : question.length;
    const end = el ? el.selectionEnd : question.length;
    const before = question.slice(0, start);
    const after = question.slice(end);

    // next number/letter counted from how many non-empty lines already exist before the cursor
    const n = before.split('\n').filter(l => l.trim() !== '').length + 1;

    let prefix = '';
    switch (style) {
      case 'number': prefix = `${n}. `; break;
      case 'roman': prefix = `${toRoman(n)}. `; break;
      case 'alpha': prefix = `${toAlpha(n)}. `; break;
      case 'bullet': prefix = '• '; break;
      case 'arrow': prefix = '→ '; break;
      case 'star': prefix = '★ '; break;
    }

    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertText = (needsNewline ? '\n' : '') + prefix;
    const updated = before + insertText + after;

    setNewPoll(prev => ({ ...prev, question: updated }));

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = before.length + insertText.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  // ─── STYLES (LIGHTER DARK THEME) ───────────────────────────────────────────
  const S = {
    page:    'min-h-screen bg-[#f8fafc] dark:bg-[#0f1219] text-gray-800 dark:text-gray-100',
    card:    'bg-white dark:bg-[#1a1e2a] border border-gray-200 dark:border-[#2a2f3f] rounded-2xl shadow-sm',
    input:   'w-full px-4 py-3 bg-gray-50 dark:bg-[#12151f] border border-gray-300 dark:border-[#2a2f3f] rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-[#3a4055] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm',
    btn:     'inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200',
    btnVi:   'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-900/20 dark:shadow-violet-900/30',
    btnGray: 'bg-gray-100 dark:bg-[#1f2330] hover:bg-gray-200 dark:hover:bg-[#2a2f3f] border border-gray-300 dark:border-[#2a2f3f] text-gray-700 dark:text-gray-300',
    btnRed:  'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400',
    badge:   'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
    th:      'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider',
    td:      'px-4 py-4 text-sm',
    expand:  'bg-gray-50 dark:bg-[#0d1017] px-4 py-5 border-t border-gray-200 dark:border-[#2a2f3f]',
  };

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (loading && viewMode === 'manage') {
    return (
      <div className={`${S.page} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-gray-500 dark:text-[#5a6080] text-sm">Loading polls…</p>
        </div>
      </div>
    );
  }

  // ─── CREATE / EDIT VIEW ────────────────────────────────────────────────────
  if (viewMode === 'create') {
    return (
      // ✅ FIX: normal page flow (no h-screen / no nested overflow-y-auto box), so the page
      // scrolls the regular way — no more "mini window scrolling inside a window" feeling.
      // Footer uses `sticky bottom-0` instead of `fixed`, so it never floats outside this
      // component's own boundaries.
      <div className={`${S.page} relative`}>
        {/* Header */}
        <div className="bg-white/90 dark:bg-[#0f1219]/95 backdrop-blur border-b border-gray-200 dark:border-[#2a2f3f] px-6 py-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/30 flex items-center justify-center">
                {isEditing ? <Pencil size={15} className="text-violet-600 dark:text-violet-400" /> : <Plus size={15} className="text-violet-600 dark:text-violet-400" />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isEditing ? 'Edit Poll' : 'Create Poll'}</h2>
                {isEditing && <span className="text-xs text-amber-600 dark:text-amber-400">Editing mode</span>}
              </div>
            </div>
            <button onClick={() => { resetForm(); setViewMode('manage'); }} className={`${S.btn} ${S.btnGray}`}>
              <X size={15} /> Cancel
            </button>
          </div>
        </div>

        {/* Content — scrolls with the normal page, extra bottom padding so the sticky footer never covers it */}
        <div>
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
            {/* Question */}
            <div className={S.card + ' p-5'}>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider mb-3">Poll Question *</label>

              {/* ✅ Quick list toolbar — click to insert at cursor position */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 dark:text-[#3a4055] mr-1">Point add karein:</span>
                <button type="button" onClick={() => insertListPrefix('number')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>1. 2. 3.</button>
                <button type="button" onClick={() => insertListPrefix('roman')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>i. ii. iii.</button>
                <button type="button" onClick={() => insertListPrefix('alpha')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>a. b. c.</button>
                <button type="button" onClick={() => insertListPrefix('bullet')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>• Bullet</button>
                <button type="button" onClick={() => insertListPrefix('arrow')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>→ Arrow</button>
                <button type="button" onClick={() => insertListPrefix('star')} className={`${S.btn} ${S.btnGray} py-1.5 px-2.5 text-xs`}>★ Star</button>
              </div>

              <textarea
                ref={questionRef}
                rows={4}
                className={S.input + ' resize-y'}
                placeholder={'Which anime is the best of this season?\n\nTip: Upar wale buttons se point add karein, ya khud Enter dabakar naya point likhein.'}
                value={newPoll.question}
                onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
              />
              <p className="text-xs text-gray-400 dark:text-[#3a4055] mt-2">
                Har point apni nayi line par home page par show hoga — mobile aur PC dono par same.
              </p>
              {!newPoll.question.trim() && <p className="text-red-500 dark:text-red-400 text-xs mt-2">Required</p>}
            </div>

            {/* Expiry */}
            <div className={S.card + ' p-5'}>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider mb-3 flexl items-center gap-2">
                <Calendar size={13} /> Expiration Date *
              </label>
              <input type="datetime-local" className={S.input}
                value={newPoll.expiresAt} min={new Date().toISOString().slice(0, 16)}
                onChange={e => setNewPoll({ ...newPoll, expiresAt: e.target.value })} />
            </div>

            {/* ✅ Browse Anime / Custom Images (tabbed) */}
            <div className={S.card + ' p-5'}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#12151f] border border-gray-200 dark:border-[#2a2f3f] rounded-xl p-1">
                  <button onClick={() => switchBrowseTab('anime')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${browseTab === 'anime' ? 'bg-violet-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                    <Search size={12} /> Browse Anime
                  </button>
                  <button onClick={() => switchBrowseTab('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${browseTab === 'custom' ? 'bg-violet-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                    <ImageIcon size={12} /> Custom Images ({savedCustomOptions.length})
                  </button>
                </div>
                <span className="text-xs text-gray-500 dark:text-[#5a6080] bg-gray-100 dark:bg-[#12151f] px-2 py-1 rounded-lg border border-gray-200 dark:border-[#2a2f3f]">
                  {browseTab === 'anime' ? `${totalAnime} total` : `${filteredCustomOptions.length} total`}
                </span>
              </div>

              <div className="relative mb-4">
                <Search size={15} className="absolute left-3 top-3.5 text-gray-400 dark:text-[#3a4055]" />
                <input className={S.input + ' pl-9 pr-9'}
                  placeholder={browseTab === 'anime' ? 'Search anime…' : 'Search custom images by title…'}
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-gray-400 dark:text-[#3a4055] hover:text-gray-700 dark:hover:text-white"><X size={15} /></button>}
              </div>

              {browseTab === 'anime' ? (
                <>
                  <div onScroll={handleAnimeGridScroll} className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto pr-1">
                    {availableAnime.map(anime => (
                      <button key={anime._id} onClick={() => addAnimeToOptions(anime)} title={anime.title}
                        className={`relative rounded-xl overflow-hidden border transition-all duration-150 ${selectedAnimeIds.includes(anime._id) ? 'border-violet-500 ring-1 ring-violet-500/40 scale-95' : 'border-gray-300 dark:border-[#2a2f3f] hover:border-violet-400/50 hover:scale-105'}`}>
                        <div className="aspect-[2/3]">
                          <img src={anime.thumbnail || ''} alt={anime.title} className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60x90?text=?'; }} />
                          {selectedAnimeIds.includes(anime._id) && (
                            <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center">
                              <CheckCircle size={18} className="text-violet-300" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {availableAnime.length === 0 && <p className="text-center text-gray-500 dark:text-[#5a6080] py-8 text-sm">No anime found</p>}
                  {loadingMoreAnime && (
                    <p className="text-center text-gray-400 dark:text-[#3a4055] text-xs mt-3">Loading more anime…</p>
                  )}
                  {!loadingMoreAnime && hasMoreAnime && availableAnime.length > 0 && (
                    <p className="text-center text-gray-400 dark:text-[#3a4055] text-xs mt-3">Scroll karte rahein — aur anime load ho rahe hain…</p>
                  )}
                </>
              ) : (
                <>
                  {/* ✅ Custom Images grid — permanently saved, survives poll deletion.
                      Auto-loads more as you scroll (infinite scroll), no button needed. */}
                  <div onScroll={handleCustomGridScroll} className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto pr-1">
                    {visibleCustomOptions.map((opt, idx) => {
                      const selected = isCustomOptionInPoll(opt);
                      return (
                        <div key={`${opt.title}-${opt.image}-${idx}`} className="relative group">
                          <button onClick={() => addSavedCustomOption(opt)} title={opt.title}
                            className={`relative w-full rounded-xl overflow-hidden border transition-all duration-150 ${selected ? 'border-violet-500 ring-1 ring-violet-500/40 scale-95' : 'border-gray-300 dark:border-[#2a2f3f] hover:border-violet-400/50 hover:scale-105'}`}>
                            <div className="aspect-[2/3]">
                              <img src={opt.image} alt={opt.title} className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60x90?text=?'; }} />
                              {selected && (
                                <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center">
                                  <CheckCircle size={18} className="text-violet-300" />
                                </div>
                              )}
                            </div>
                          </button>
                          <button onClick={() => removeSavedCustomOption(opt)} title="Remove from saved list"
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <X size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {filteredCustomOptions.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-[#5a6080] py-8 text-sm px-4">
                      Abhi koi custom image save nahi hai. Neeche "Custom Option" mein title + image URL daal kar add karein — ye yahan hamesha ke liye save rahega, poll delete hone par bhi.
                    </p>
                  )}
                  {filteredCustomOptions.length > 0 && customVisibleCount < filteredCustomOptions.length && (
                    <p className="text-center text-gray-400 dark:text-[#3a4055] text-xs mt-3">Scroll karte rahein — aur images load ho rahi hain…</p>
                  )}
                </>
              )}
            </div>

            {/* Custom Option */}
            <div className={S.card + ' p-5'}>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider mb-4 flexl items-center gap-2">
                <Link size={13} /> Custom Option
              </label>
              <div className="flex gap-3">
                <input className={S.input} placeholder="Title" value={customOption.title} onChange={e => setCustomOption({ ...customOption, title: e.target.value })} />
                <input className={S.input} placeholder="Image URL" value={customOption.imageUrl} onChange={e => setCustomOption({ ...customOption, imageUrl: e.target.value })} />
                <button onClick={addCustomOption} disabled={!customOption.title || !customOption.imageUrl}
                  className={`${S.btn} ${S.btnVi} flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <Plus size={15} />
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-[#3a4055] mt-3">
                Add karte hi ye "Custom Images" tab mein (upar) hamesha ke liye save ho jayega — future polls mein wahan se seedha select kar sakte hain.
              </p>
            </div>

            {/* Selected Options */}
            <div className={S.card + ' p-5'}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider">Selected Options</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-md font-mono ${newPoll.options.length >= 4 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}`}>
                    {newPoll.options.length}/10
                  </span>
                </div>
                {newPoll.options.length < 4 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Need {4 - newPoll.options.length} more</span>
                )}
              </div>

              {newPoll.options.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-[#3a4055] border border-dashed border-gray-300 dark:border-[#2a2f3f] rounded-xl">
                  <Plus size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No options added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {newPoll.options.map((option, idx) => (
                    <div key={option.animeId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#12151f] rounded-xl border border-gray-200 dark:border-[#2a2f3f] group">
                      <span className="text-xs text-gray-400 dark:text-[#3a4055] font-mono w-5 text-center">{idx + 1}</span>
                      <img src={option.image} alt={option.title} className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=?'; }} />
                      <div className="flex-1 min-w-0">
                        {editingIndex === idx ? (
                          <div className="flex items-center gap-2">
                            <input className={S.input + ' py-1.5 text-xs'} value={editedTitle} onChange={e => setEditedTitle(e.target.value)}
                              autoFocus onKeyDown={e => e.key === 'Enter' && saveEditedTitle(idx)} />
                            <button onClick={() => saveEditedTitle(idx)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"><Save size={14} /></button>
                            <button onClick={() => setEditingIndex(null)} className="text-gray-400 dark:text-[#3a4055] hover:text-gray-700 dark:hover:text-white"><X size={14} /></button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-800 dark:text-white truncate">{option.title}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-[#5a6080]">{option.animeId.startsWith('custom_') ? 'Custom' : 'Anime'}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingIndex(idx); setEditedTitle(option.title); }}
                          className="p-1.5 text-gray-400 dark:text-[#3a4055] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/20 rounded-lg transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => removeAnimeOption(idx)}
                          className="p-1.5 text-gray-400 dark:text-[#3a4055] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ✅ NEW: Live Preview — exactly kaisa home page par dikhega */}
            <div className={S.card + ' p-5'}>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-[#5a6080] uppercase tracking-wider mb-4">
                <EyeIcon size={13} /> Home Page Preview
              </label>
              <div className="max-w-sm mx-auto w-full bg-[#1a1a1a] rounded-lg border border-gray-700 overflow-hidden">
                <div className="flex items-center px-3 pt-2 pb-2 bg-gray-800/30 border-b border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs font-bold text-gray-300">A</div>
                  <div className="ml-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">Admin</span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded-full font-semibold leading-none">Creater</span>
                  </div>
                </div>

                <div className="px-3 pt-2 pb-3">
                  <h3 className="text-sm font-semibold text-gray-100 break-words">
                    {newPoll.question.trim() ? renderMultilineText(newPoll.question) : <span className="text-gray-500 italic">Aapka question yahan dikhega…</span>}
                  </h3>
                </div>

                <div className="px-2 pb-3 space-y-2 pt-2">
                  {newPoll.options.length === 0 ? (
                    <p className="text-center text-gray-500 text-xs py-6">Options add karein preview dekhne ke liye</p>
                  ) : (
                    newPoll.options.map((opt, idx) => (
                      <div key={`${opt.animeId}-${idx}`} className="relative rounded-md border border-gray-700 bg-[#222222] p-1">
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center flex-1 min-w-0">
                            <div className="flex-shrink-0 w-14 h-14 overflow-hidden rounded-md border border-gray-700">
                              <img
                                src={opt.image || 'https://via.placeholder.com/56x56?text=No+Image'}
                                alt={opt.title}
                                className="w-full h-full object-cover"
                                onError={e => (e.currentTarget.src = 'https://via.placeholder.com/56x56?text=No+Image')}
                              />
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                              <span className="text-xs font-medium text-gray-300 break-words whitespace-normal block">{opt.title}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-3 py-2 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">0 votes</span>
                    <span className="text-xs text-gray-400">Click to vote</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-gray-400 dark:text-[#5a6080] mt-3">
                Ye card mobile aur PC — dono par bilkul isi tarah dikhega (single column, same layout).
              </p>
            </div>
          </div>
        </div>

        {/* Footer — normal bar at the end of the content, no sticky/fixed positioning */}
        <div className="bg-white/95 dark:bg-[#0f1219]/95 border-t border-gray-200 dark:border-[#2a2f3f] px-6 py-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isFormValid ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`} />
              <span className={`text-xs ${isFormValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isFormValid ? 'Ready to submit' : `${newPoll.options.length}/4 options minimum`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { resetForm(); setViewMode('manage'); }} className={`${S.btn} ${S.btnGray}`}>
                Cancel
              </button>
              <button onClick={isEditing ? handleUpdatePoll : handleCreatePoll}
                disabled={!isFormValid || creatingPoll || updatingPoll}
                className={`${S.btn} ${S.btnVi} px-6 disabled:opacity-40 disabled:cursor-not-allowed min-w-[130px] justify-center`}>
                {(creatingPoll || updatingPoll)
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isEditing ? 'Updating…' : 'Creating…'}</>
                  : isEditing ? <><Save size={15} /> Update</> : <><Zap size={15} /> Create Poll</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── MANAGE VIEW ───────────────────────────────────────────────────────────
  return (
    <div className={`${S.page} p-6 space-y-6`}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-violet-600 dark:text-violet-400" /> Poll Manager
          </h2>
          <p className="text-xs text-gray-500 dark:text-[#5a6080] mt-0.5">Create and manage audience polls</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={deleteExpiredPolls} disabled={expiredPolls.length === 0} className={`${S.btn} ${S.btnRed} disabled:opacity-30 disabled:cursor-not-allowed`}>
            <Trash2 size={14} /> Expired ({expiredPolls.length})
          </button>
          <button onClick={fetchPolls} className={`${S.btn} ${S.btnGray}`}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { resetForm(); setViewMode('create'); }} className={`${S.btn} ${S.btnVi}`}>
            <Plus size={15} /> New Poll
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: polls.length, icon: <FileText size={16} />, color: 'text-gray-800 dark:text-white' },
          { label: 'Active', value: activePolls.length, icon: <Zap size={16} />, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Expired', value: expiredPolls.length, icon: <Clock size={16} />, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Voters', value: polls.reduce((t, p) => t + (p.votersCount || 0), 0), icon: <Users size={16} />, color: 'text-violet-600 dark:text-violet-400' },
        ].map(stat => (
          <div key={stat.label} className={`${S.card} p-4 flex items-center gap-3`}>
            <div className={`${stat.color} opacity-60`}>{stat.icon}</div>
            <div>
              <p className="text-[10px] text-gray-500 dark:text-[#5a6080] uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#12151f] border border-gray-200 dark:border-[#2a2f3f] rounded-xl p-1 w-fit">
        <button onClick={() => setShowExpired(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!showExpired ? 'bg-violet-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
          Active ({polls.length - expiredPolls.length})
        </button>
        <button onClick={() => setShowExpired(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showExpired ? 'bg-amber-600 text-white' : 'text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
          Expired ({expiredPolls.length})
        </button>
      </div>

      {/* Polls Table with Inline Expandable Details */}
      <div className={S.card + ' overflow-hidden'}>
        {filteredPolls.length === 0 ? (
          <div className="text-center py-16">
            <Award size={32} className="mx-auto text-gray-300 dark:text-[#2a2f3f] mb-3" />
            <p className="text-gray-500 dark:text-[#5a6080] text-sm">{showExpired ? 'No expired polls' : 'No active polls'}</p>
            {!showExpired && (
              <button onClick={() => { resetForm(); setViewMode('create'); }} className={`${S.btn} ${S.btnVi} mt-4`}>
                <Plus size={15} /> Create first poll
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#12151f] border-b border-gray-200 dark:border-[#2a2f3f]">
                <tr>
                  <th className={S.th}>Question</th>
                  <th className={S.th}>Status</th>
                  <th className={S.th}>Options</th>
                  <th className={S.th}>Votes</th>
                  <th className={S.th}>Expires</th>
                  <th className={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolls.map((poll, i) => {
                  const expired = !!(poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) < new Date()));
                  const isExpanded = expandedPollId === poll._id;
                  return (
                    <React.Fragment key={poll._id}>
                      <tr className={`border-t border-gray-200 dark:border-[#2a2f3f] hover:bg-gray-50 dark:hover:bg-[#12151f] transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-[#0d1017]/40'}`}>
                        <td className={S.td + ' max-w-[260px]'}>
                          <p className="text-gray-800 dark:text-white text-sm font-medium whitespace-pre-line" title={poll.question}>
                            {truncate(poll.question, 55)}
                          </p>
                          <p className="text-gray-500 dark:text-[#5a6080] text-xs mt-0.5">
                            {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </td>
                        <td className={S.td}>
                          <span className={`${S.badge} ${
                            expired ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                            : poll.isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                            : 'bg-gray-100 dark:bg-[#1f2330] text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#2a2f3f]'
                          }`}>
                            {expired ? <><AlertCircle size={10} /> Expired</>
                              : poll.isActive ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Live</>
                              : <><EyeOff size={10} /> Paused</>}
                          </span>
                        </td>
                        <td className={S.td}>
                          <span className="text-gray-800 dark:text-white font-mono text-sm">{poll.options?.length || 0}</span>
                        </td>
                        <td className={S.td}>
                          <p className="text-gray-800 dark:text-white text-sm font-semibold">{poll.totalVotes || 0}</p>
                          <p className="text-gray-500 dark:text-[#5a6080] text-xs flex items-center gap-1">
                            <Users size={10} /> {poll.votersCount || 0}
                          </p>
                        </td>
                        <td className={S.td}>
                          <p className={`text-xs ${expired ? 'text-amber-600 dark:text-amber-400/80' : 'text-gray-500 dark:text-[#5a6080]'}`}>
                            {poll.expiresAt ? new Date(poll.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </p>
                        </td>
                        <td className={S.td}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {!expired && (
                              <button onClick={() => togglePollStatus(poll._id)}
                                className={`${S.btn} py-1.5 px-3 text-xs ${poll.isActive ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/50' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'}`}>
                                {poll.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleDetails(poll)}
                              className={`${S.btn} py-1.5 px-3 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/50`}
                              title="Details / Results">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isExpanded ? 'Hide' : loadingDetailsId === poll._id ? 'Loading…' : 'Details'}
                            </button>
                            <button onClick={() => handleEditPoll(poll)} disabled={!!expired}
                              className={`${S.btn} py-1.5 px-3 text-xs border ${expired ? 'bg-gray-100 dark:bg-[#1f2330] text-gray-400 dark:text-[#3a4055] border-gray-300 dark:border-[#2a2f3f] cursor-not-allowed' : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-900/40 hover:bg-violet-100 dark:hover:bg-violet-900/50'}`} title="Edit">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleDuplicatePoll(poll)}
                              className={`${S.btn} py-1.5 px-3 text-xs bg-gray-100 dark:bg-[#1f2330] text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#2a2f3f] hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2f3f]`} title="Duplicate">
                              <Copy size={12} />
                            </button>
                            <button onClick={() => exportPollResults(poll)}
                              className={`${S.btn} py-1.5 px-3 text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/50`} title="Export Results">
                              <Download size={12} />
                            </button>
                            <button onClick={() => deletePoll(poll._id)}
                              className={`${S.btn} py-1.5 px-3 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/50`} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* INLINE EXPANDED ROW – shows results & voters */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className={S.expand}>
                            <div className="space-y-5">
                              {/* Poll Results */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-3">
                                  <BarChart3 size={14} className="text-violet-600 dark:text-violet-400" /> Results
                                </h4>
                                <div className="space-y-2">
                                  {poll.options?.map((opt, idx) => {
                                    const pct = poll.totalVotes ? Math.round((opt.votes || 0) / poll.totalVotes * 100) : 0;
                                    return (
                                      <div key={idx} className="bg-gray-50 dark:bg-[#12151f] rounded-xl border border-gray-200 dark:border-[#2a2f3f] p-3">
                                        <div className="flex items-center gap-3 mb-2">
                                          <img src={opt.image} alt={opt.title} className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                                            onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/36?text=?'; }} />
                                          <p className="text-sm text-gray-800 dark:text-white flex-1 truncate">{opt.title}</p>
                                          <span className="text-xs font-mono text-gray-500 dark:text-[#5a6080]">{opt.votes || 0} · {pct}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-200 dark:bg-[#1e2332] rounded-full overflow-hidden">
                                          <div className="h-full bg-gradient-to-r from-violet-600 to-pink-600 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex justify-end mt-3">
                                  <button onClick={() => exportPollResults(poll)} className={`${S.btn} ${S.btnGray} text-xs py-1.5`}>
                                    <Download size={12} /> Export CSV
                                  </button>
                                </div>
                              </div>

                              {/* Voters Breakdown & List */}
                              {(poll.voters as any[])?.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-3">
                                    <Users size={14} className="text-violet-600 dark:text-violet-400" /> Voters
                                  </h4>
                                  {/* Device breakdown */}
                                  <div className="grid grid-cols-3 gap-3 mb-4">
                                    {['mobile', 'tablet', 'desktop'].map(type => {
                                      const voters = poll.voters as any[];
                                      const count = voters?.filter(v => (v.deviceType || '').toLowerCase() === type).length || 0;
                                      const pct = voters?.length ? ((count / voters.length) * 100).toFixed(0) : 0;
                                      return (
                                        <div key={type} className="bg-gray-50 dark:bg-[#12151f] p-3 rounded-xl border border-gray-200 dark:border-[#2a2f3f]">
                                          <div className="flex items-center gap-2 text-gray-500 dark:text-[#5a6080] mb-2">{getDeviceIcon(type)}<span className="text-xs">{formatDeviceType(type)}</span></div>
                                          <p className="text-xl font-bold text-gray-800 dark:text-white">{count}</p>
                                          <p className="text-xs text-gray-500 dark:text-[#5a6080]">{pct}%</p>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Voters list table */}
                                  <div className="overflow-x-auto">
                                    <div className="grid grid-cols-12 text-[10px] text-gray-500 dark:text-[#5a6080] uppercase tracking-wider px-3 py-2 border-b border-gray-200 dark:border-[#2a2f3f]">
                                      <div className="col-span-1">#</div>
                                      <div className="col-span-2">Device</div>
                                      <div className="col-span-5">Time</div>
                                      <div className="col-span-4">Voted for</div>
                                    </div>
                                    {(poll.voters as any[]).map((voter, i) => {
                                      const opt = poll.options?.find(o => o._id === voter.optionId || o.animeId === voter.optionId);
                                      return (
                                        <div key={i} className="grid grid-cols-12 items-center px-3 py-2.5 bg-gray-50 dark:bg-[#12151f] border-b border-gray-200 dark:border-[#2a2f3f] text-sm">
                                          <div className="col-span-1 text-gray-500 dark:text-[#5a6080] text-xs font-mono">{i + 1}</div>
                                          <div className="col-span-2 flex items-center gap-1.5 text-gray-500 dark:text-[#5a6080]">
                                            {getDeviceIcon(voter.deviceType)}
                                            <span className="text-xs">{formatDeviceType(voter.deviceType)}</span>
                                          </div>
                                          <div className="col-span-5 text-gray-500 dark:text-[#5a6080] text-xs">
                                            {voter.votedAt ? new Date(voter.votedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </div>
                                          <div className="col-span-4 text-gray-800 dark:text-white text-xs truncate" title={opt?.title}>{opt?.title || '—'}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex justify-end mt-3">
                                    <button onClick={() => exportVotersList(poll)} className={`${S.btn} ${S.btnGray} text-xs py-1.5`}>
                                      <FileText size={12} /> Export voters CSV
                                    </button>
                                  </div>
                                </div>
                              )}
                              {!poll.voters?.length && (
                                <div className="text-center py-4 text-gray-500 dark:text-[#5a6080] text-sm border border-dashed border-gray-300 dark:border-[#2a2f3f] rounded-xl">
                                  No votes yet
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollManager;