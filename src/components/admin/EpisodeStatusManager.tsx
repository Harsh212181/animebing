 // src/components/admin/EpisodeStatusManager.tsx – Premium UI, mobile cards, dropdown filters
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { CONTENT_TYPE_OPTIONS } from '../../utils/contentGroup';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface Anime {
  _id: string;
  title: string;
  thumbnail?: string;
  totalEpisodes: number;
  currentEpisode: number;
  contentType: string;
  status: string;
  subDubStatus?: string;
  createdBy?: string;
  createdByUsername?: string;
}

interface DownloadLink {
  episode: number;
  url: string;
  quality?: string;
  language?: string;
  type?: 'download' | 'watch';
}

interface DownloadPage {
  _id: string;
  animeId: string;
  slug: string;
  title: string;
  episodeNumber?: number;
  links: DownloadLink[];
  createdAt: Date;
  updatedAt: Date;
}

interface EpisodeStatusManagerProps {
  token?: string;
  isMainAdmin?: boolean;
}

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  badge:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  chevronDown: 'M19 9l-7 7-7-7',
  check:     'M5 13l4 4L19 7',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  warning:   'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  save:      'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  sync:      'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  crown:     'M5 16l2-8 5 4 5-4 2 8H5z M3 20h18',
  user:      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  empty:     'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
};

// ============ CUSTOM STYLED DROPDOWN ============
interface SelectOption {
  value: string;
  label: string;
}

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
}> = ({ value, onChange, options, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full bg-white/[0.04] border text-white rounded-lg px-3 py-2 text-xs text-left transition-all flex items-center justify-between gap-2 ${
          isOpen ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-white/[0.08] hover:border-white/[0.14]'
        }`}
      >
        <span className="truncate">{selected?.label || 'Select...'}</span>
        <SvgIcon d={ICONS.chevronDown} className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1.5 w-full bg-[#151422] border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1 max-h-72 overflow-y-auto">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-500/15 text-purple-200' : 'text-gray-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <SvgIcon d={ICONS.check} className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Sub/Dub badge color helper ───────────────────────────────────────
const getSubDubBadge = (status?: string) => {
  if (!status) return null;
  const map: Record<string, string> = {
    'Hindi Dub':   'bg-red-500/15 text-red-300 border-red-500/25',
    'Hindi Sub':   'bg-orange-500/15 text-orange-300 border-orange-500/25',
    'English Sub': 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  };
  const cls = map[status] || 'bg-purple-500/15 text-purple-300 border-purple-500/25';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}>
      {status}
    </span>
  );
};

// ── Status badge ─────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isOngoing = status === 'Ongoing';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
      isOngoing
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
        : 'bg-blue-500/15 text-blue-300 border-blue-500/25'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOngoing ? 'bg-emerald-400' : 'bg-blue-400'}`} />
      {status}
    </span>
  );
};

const EpisodeStatusManager: React.FC<EpisodeStatusManagerProps> = ({ token: tokenProp, isMainAdmin = false }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [filteredList, setFilteredList] = useState<Anime[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ongoing' | 'Complete'>('all');
  const [subDubFilter, setSubDubFilter] = useState<'all' | 'Hindi Sub' | 'Hindi Dub' | 'English Sub'>('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'admin' | 'subadmin'>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [syncModalAnime, setSyncModalAnime] = useState<{ id: string; title: string } | null>(null);
  const [syncModalPages, setSyncModalPages] = useState<DownloadPage[]>([]);
  const [syncModalLoading, setSyncModalLoading] = useState(false);
  const [confirmingPageId, setConfirmingPageId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnime();
  }, []);

  useEffect(() => {
    let filtered = animeList;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(anime =>
        anime.title.toLowerCase().includes(term)
      );
    }

    if (contentTypeFilter !== 'all') {
      filtered = filtered.filter(
        anime => anime.contentType === contentTypeFilter
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(anime => anime.status === statusFilter);
    }

    if (subDubFilter !== 'all') {
      filtered = filtered.filter(
        anime => anime.subDubStatus === subDubFilter
      );
    }

    if (creatorFilter === 'admin') {
      filtered = filtered.filter(a => !a.createdBy || a.createdBy === 'admin');
    }
    if (creatorFilter === 'subadmin') {
      filtered = filtered.filter(a => a.createdBy && a.createdBy !== 'admin');
    }

    setFilteredList(filtered);
  }, [searchTerm, animeList, contentTypeFilter, statusFilter, subDubFilter, creatorFilter]);

  const fetchAnime = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const { data } = await axios.get(
        `${API_BASE}/admin/protected/anime-list`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAnimeList(data);
      setFilteredList(data);
    } catch (err: any) {
      console.error('Failed to fetch anime list', err);
      setError(
        err.response?.data?.error || err.message || 'Failed to load anime'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (
    id: string,
    totalEpisodes: number,
    currentEpisode: number
  ) => {
    setSavingId(id);
    setError('');
    const toastId = toast.loading('Updating episode status...');
    try {
      const token = getToken();
      await axios.patch(
        `${API_BASE}/admin/protected/anime/${id}/episode-status`,
        { totalEpisodes, currentEpisode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnimeList(prev =>
        prev.map(a =>
          a._id === id ? { ...a, totalEpisodes, currentEpisode } : a
        )
      );
      toast.success('Episode status updated successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Update failed', err);
      toast.error(
        'Failed to update: ' +
          (err.response?.data?.error || err.message),
        { id: toastId }
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSync = async (id: string, title: string) => {
    setSyncModalLoading(true);
    setSyncModalAnime({ id, title });
    setSyncModalPages([]);
    try {
      const token = getToken();
      const { data: pages } = await axios.get<DownloadPage[]>(
        `${API_BASE}/download-pages/anime/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!pages || pages.length === 0) {
        toast.error('No download pages found for this anime.');
        setSyncModalAnime(null);
        return;
      }

      if (pages.length === 1) {
        await syncWithSpecificPage(id, pages[0]);
        setSyncModalAnime(null);
        return;
      }

      setSyncModalPages(pages);
    } catch (err: any) {
      console.error('Sync fetch failed', err);
      toast.error('Failed to load pages: ' + (err.response?.data?.error || err.message));
      setSyncModalAnime(null);
    } finally {
      setSyncModalLoading(false);
    }
  };

  const syncWithSpecificPage = async (animeId: string, page: DownloadPage) => {
    setConfirmingPageId(page._id);
    const toastId = toast.loading('Syncing from selected page...');
    try {
      const watchLinks = page.links.filter(l => (l.type || 'watch') === 'watch');
      let maxEpisode = 0;
      watchLinks.forEach(link => {
        if (link.episode > maxEpisode) maxEpisode = link.episode;
      });

      if (maxEpisode === 0) {
        toast.error('Is page me koi valid episode number nahi mila.', { id: toastId });
        return;
      }

      const token = getToken();
      await axios.patch(
        `${API_BASE}/admin/protected/anime/${animeId}/episode-status`,
        { currentEpisode: maxEpisode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAnimeList(prev =>
        prev.map(a => (a._id === animeId ? { ...a, currentEpisode: maxEpisode } : a))
      );

      toast.success(`Synced! Current episode set to ${maxEpisode}`, { id: toastId });
      setSyncModalAnime(null);
    } catch (err: any) {
      console.error('Sync failed', err);
      toast.error('Sync failed: ' + (err.response?.data?.error || err.message), { id: toastId });
    } finally {
      setConfirmingPageId(null);
    }
  };

  const updateLocalField = (id: string, field: 'totalEpisodes' | 'currentEpisode', value: number) => {
    setAnimeList(prev =>
      prev.map(a => (a._id === id ? { ...a, [field]: value } : a))
    );
  };

  const hasActiveFilters =
    contentTypeFilter !== 'all' ||
    statusFilter !== 'all' ||
    subDubFilter !== 'all' ||
    creatorFilter !== 'all';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0b0a14]">
        <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="mt-3 text-xs text-gray-500 font-medium">Loading anime list...</p>
      </div>
    );
  }

  const inputCls = "w-full px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white text-center outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20";

  return (
    <div className="p-3 sm:p-6 space-y-4 min-h-screen bg-[#0b0a14] text-white">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 shadow-lg shadow-purple-500/10">
          <SvgIcon d={ICONS.badge} className="w-6 h-6 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Episode Status Manager</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track and manage episode counts across all content</p>
        </div>
        {filteredList.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
            {filteredList.length} / {animeList.length}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-xs">
          <SvgIcon d={ICONS.warning} className="w-4 h-4 text-rose-400 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Filter bar ────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isMainAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <CustomSelect
            label="Type"
            value={contentTypeFilter}
            onChange={setContentTypeFilter}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'Movie', label: 'Movie (Legacy)' },
              ...CONTENT_TYPE_OPTIONS.map(t => ({ value: t, label: t })),
            ]}
          />

          <CustomSelect
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'Ongoing', label: 'Ongoing' },
              { value: 'Complete', label: 'Complete' },
            ]}
          />

          <CustomSelect
            label="Sub/Dub"
            value={subDubFilter}
            onChange={(v) => setSubDubFilter(v as any)}
            options={[
              { value: 'all', label: 'All Sub/Dub' },
              { value: 'Hindi Sub', label: 'Hindi Sub' },
              { value: 'Hindi Dub', label: 'Hindi Dub' },
              { value: 'English Sub', label: 'English Sub' },
            ]}
          />

          {isMainAdmin && (
            <CustomSelect
              label="Creator"
              value={creatorFilter}
              onChange={(v) => setCreatorFilter(v as any)}
              options={[
                { value: 'all', label: 'All Creators' },
                { value: 'admin', label: 'Main Admin' },
                { value: 'subadmin', label: 'Sub-Admin' },
              ]}
            />
          )}

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search title..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20"
              />
              <SvgIcon d={ICONS.search} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-gray-500">
              Filters active
            </span>
            <button
              onClick={() => {
                setContentTypeFilter('all');
                setStatusFilter('all');
                setSubDubFilter('all');
                setCreatorFilter('all');
              }}
              className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {filteredList.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <SvgIcon d={ICONS.empty} className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400 font-medium">No anime match your filters</p>
          <p className="text-[10px] text-gray-600 mt-1">Try clearing filters or changing search</p>
        </div>
      ) : (
        <>
          {/* ─── Mobile Card View ─────────────────────── */}
          <div className="lg:hidden space-y-2">
            {filteredList.map(anime => (
              <div key={anime._id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="flex gap-3 p-3">
                  <img
                    src={
                      anime.thumbnail ||
                      'https://via.placeholder.com/72x96/1e293b/64748b?text=NA'
                    }
                    alt={anime.title}
                    className="w-14 h-[76px] rounded-lg object-cover border border-white/[0.08] flex-shrink-0"
                    loading="lazy"
                    onError={e => {
                      e.currentTarget.src = 'https://via.placeholder.com/72x96/1e293b/64748b?text=NA';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug break-words">{anime.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {anime.status && <StatusBadge status={anime.status} />}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                        {anime.contentType || 'Anime'}
                      </span>
                      {getSubDubBadge(anime.subDubStatus)}
                      {isMainAdmin && (
                        (!anime.createdBy || anime.createdBy === 'admin') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            <SvgIcon d={ICONS.crown} className="w-2.5 h-2.5" /> Admin
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25"
                            title={`Created by: ${anime.createdByUsername}`}
                          >
                            <SvgIcon d={ICONS.user} className="w-2.5 h-2.5" /> {anime.createdByUsername || 'Sub'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 px-3 pb-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Episodes</label>
                    <input
                      type="number"
                      min="0"
                      value={anime.totalEpisodes ?? 0}
                      onChange={e => updateLocalField(anime._id, 'totalEpisodes', parseInt(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Current Episode</label>
                    <input
                      type="number"
                      min="0"
                      value={anime.currentEpisode ?? 0}
                      onChange={e => updateLocalField(anime._id, 'currentEpisode', parseInt(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 px-3 pb-3">
                  <button
                    onClick={() => handleUpdate(anime._id, anime.totalEpisodes, anime.currentEpisode)}
                    disabled={savingId === anime._id}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-300 text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingId === anime._id ? (
                      <><span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><SvgIcon d={ICONS.save} className="w-3 h-3" /> Save</>
                    )}
                  </button>
                  <button
                    onClick={() => handleSync(anime._id, anime.title)}
                    disabled={syncModalAnime?.id === anime._id && syncModalLoading}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {syncModalAnime?.id === anime._id && syncModalLoading ? (
                      <><span className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" /> Loading...</>
                    ) : (
                      <><SvgIcon d={ICONS.sync} className="w-3 h-3" /> Sync</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Desktop Table View ───────────────────── */}
          <div className="hidden lg:block bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Image</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Title</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Type</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Sub/Dub</th>
                    {isMainAdmin && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Creator</th>
                    )}
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Total</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Current</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map(anime => (
                    <tr key={anime._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5">
                        <img
                          src={anime.thumbnail || 'https://via.placeholder.com/64x88/1e293b/64748b?text=NA'}
                          alt={anime.title}
                          className="w-12 h-16 object-cover rounded-lg border border-white/[0.08]"
                          loading="lazy"
                          onError={e => {
                            e.currentTarget.src = 'https://via.placeholder.com/64x88/1e293b/64748b?text=NA';
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-white truncate" title={anime.title}>
                            {anime.title}
                          </span>
                          {anime.status && <StatusBadge status={anime.status} />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                          {anime.contentType || 'Anime'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {anime.subDubStatus ? getSubDubBadge(anime.subDubStatus) : <span className="text-gray-600">—</span>}
                      </td>
                      {isMainAdmin && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {(!anime.createdBy || anime.createdBy === 'admin') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                              <SvgIcon d={ICONS.crown} className="w-2.5 h-2.5" /> Admin
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25"
                              title={`Created by: ${anime.createdByUsername}`}
                            >
                              <SvgIcon d={ICONS.user} className="w-2.5 h-2.5" /> {anime.createdByUsername || 'Sub'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={anime.totalEpisodes ?? 0}
                          onChange={e => updateLocalField(anime._id, 'totalEpisodes', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white text-center outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={anime.currentEpisode ?? 0}
                          onChange={e => updateLocalField(anime._id, 'currentEpisode', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white text-center outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleUpdate(anime._id, anime.totalEpisodes, anime.currentEpisode)}
                            disabled={savingId === anime._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-300 text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingId === anime._id ? (
                              <><span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" /> Saving</>
                            ) : (
                              <><SvgIcon d={ICONS.save} className="w-3 h-3" /> Save</>
                            )}
                          </button>
                          <button
                            onClick={() => handleSync(anime._id, anime.title)}
                            disabled={syncModalAnime?.id === anime._id && syncModalLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {syncModalAnime?.id === anime._id && syncModalLoading ? (
                              <><span className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" /> Loading</>
                            ) : (
                              <><SvgIcon d={ICONS.sync} className="w-3 h-3" /> Sync</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Page-selection modal ──────────────────────── */}
      {syncModalAnime && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !syncModalLoading && setSyncModalAnime(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151422] p-5 shadow-2xl shadow-black/40"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <SvgIcon d={ICONS.sync} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-sm font-bold text-white">Select Page to Sync</h3>
                <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
                  <span className="text-white font-semibold">"{syncModalAnime.title}"</span> ke {syncModalPages.length} download pages hain. Sirf selected page ka max episode number use hoga.
                </p>
              </div>
            </div>

            {syncModalLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {syncModalPages.map((page, idx) => {
                  const watchLinks = page.links.filter(l => (l.type || 'watch') === 'watch');
                  const maxEp = watchLinks.reduce((m, l) => Math.max(m, l.episode), 0);
                  return (
                    <button
                      key={page._id}
                      onClick={() => syncWithSpecificPage(syncModalAnime.id, page)}
                      disabled={confirmingPageId === page._id}
                      className="w-full flex items-center justify-between gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.14] rounded-xl px-3 py-2.5 text-left transition-all disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white">Page {idx + 1}</p>
                        <p className="text-[10px] text-gray-500 truncate font-mono">{page.slug}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {watchLinks.length} watch
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25">
                          Max: {maxEp || '—'}
                        </span>
                        {confirmingPageId === page._id && (
                          <span className="w-3.5 h-3.5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSyncModalAnime(null)}
                disabled={syncModalLoading}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EpisodeStatusManager;