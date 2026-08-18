 // src/components/admin/EpisodeStatusManager.tsx – Dropdown filters + mobile card view + Sub/Dub badge + Creator badge
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

// ============ CUSTOM STYLED DROPDOWN (reused pattern) ============
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
      <label className="block text-xs font-medium text-white/60 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full bg-gray-800/60 border text-white rounded-lg px-3 py-2.5 text-sm text-left transition-all flex items-center justify-between gap-2 ${
          isOpen ? 'border-purple-500/60 ring-1 ring-purple-500/30' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <span className="truncate">{selected?.label || 'Select...'}</span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl shadow-black/50 py-1.5 max-h-72 overflow-y-auto animate-fadeIn">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-600/20 text-purple-200' : 'text-slate-300 hover:bg-gray-700'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-lg">Loading anime list...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl">
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Episode Status Manager
        </h1>
      </div>

      {error && (
        <div className="relative p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-sm text-rose-200 flex items-center gap-3 shadow-lg shadow-rose-500/5">
          <svg
            className="w-5 h-5 text-rose-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Filter bar – Dropdown style */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl">
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

          {/* Search */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-white/60 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 pl-8"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Clear filters & count */}
        <div className="text-xs text-white/40 mt-3 flex items-center gap-2 flex-wrap">
          <span>
            {filteredList.length} / {animeList.length} anime
          </span>
          {(contentTypeFilter !== 'all' ||
            statusFilter !== 'all' ||
            subDubFilter !== 'all' ||
            creatorFilter !== 'all') && (
            <button
              onClick={() => {
                setContentTypeFilter('all');
                setStatusFilter('all');
                setSubDubFilter('all');
                setCreatorFilter('all');
              }}
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-white/20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <p className="mt-4 text-white/60 text-lg">
            No anime match your filters.
          </p>
        </div>
      ) : (
        <>
          {/* ============ MOBILE CARD VIEW (below lg) ============ */}
          <div className="lg:hidden space-y-3">
            {filteredList.map(anime => (
              <div key={anime._id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex gap-3 p-3">
                  <img
                    src={
                      anime.thumbnail ||
                      'https://via.placeholder.com/72x96/1e293b/64748b?text=NA'
                    }
                    alt={anime.title}
                    className="w-16 h-[86px] rounded-lg object-cover shadow-lg flex-shrink-0"
                    loading="lazy"
                    onError={e => {
                      e.currentTarget.src =
                        'https://via.placeholder.com/72x96/1e293b/64748b?text=NA';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug break-words">{anime.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {anime.status && (
                        <span
                          className={`px-2 py-0.5 text-[11px] rounded-full ${
                            anime.status === 'Ongoing'
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {anime.status}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-purple-600/30 text-purple-200">
                        {anime.contentType || 'Anime'}
                      </span>
                      {anime.subDubStatus && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            anime.subDubStatus === 'Hindi Dub'
                              ? 'bg-red-600/80 text-white'
                              : anime.subDubStatus === 'Hindi Sub'
                              ? 'bg-orange-600/80 text-white'
                              : anime.subDubStatus === 'English Sub'
                              ? 'bg-blue-600/80 text-white'
                              : 'bg-purple-600/80 text-white'
                          }`}
                        >
                          {anime.subDubStatus}
                        </span>
                      )}
                      {isMainAdmin && (
                        (!anime.createdBy || anime.createdBy === 'admin') ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            Main Admin
                          </span>
                        ) : (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25"
                            title={`Created by sub-admin: ${anime.createdByUsername}`}
                          >
                            {anime.createdByUsername || 'Sub-Admin'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Total / Current inputs */}
                <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Total Episodes</label>
                    <input
                      type="number"
                      min="0"
                      value={anime.totalEpisodes ?? 0}
                      onChange={e => updateLocalField(anime._id, 'totalEpisodes', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Current Episode</label>
                    <input
                      type="number"
                      min="0"
                      value={anime.currentEpisode ?? 0}
                      onChange={e => updateLocalField(anime._id, 'currentEpisode', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-3 pb-3">
                  <button
                    onClick={() =>
                      handleUpdate(
                        anime._id,
                        anime.totalEpisodes,
                        anime.currentEpisode
                      )
                    }
                    disabled={savingId === anime._id}
                    className="flex-1 px-2 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-lg text-indigo-200 text-xs font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingId === anime._id ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-indigo-200 border-t-transparent rounded-full"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                          />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleSync(anime._id, anime.title)}
                    disabled={syncModalAnime?.id === anime._id && syncModalLoading}
                    className="flex-1 px-2 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg text-emerald-200 text-xs font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncModalAnime?.id === anime._id && syncModalLoading ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-emerald-200 border-t-transparent rounded-full"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Sync
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ============ DESKTOP TABLE VIEW (lg and up) ============ */}
          <div className="hidden lg:block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Sub/Dub
                    </th>
                    {isMainAdmin && (
                      <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Creator
                      </th>
                    )}
                    <th className="px-2 sm:px-3 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-2 sm:px-3 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredList.map(anime => (
                    <tr
                      key={anime._id}
                      className="hover:bg-white/5 transition"
                    >
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <img
                          src={
                            anime.thumbnail ||
                            'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image'
                          }
                          alt={anime.title}
                          className="w-18 h-21 sm:w-20 sm:h-22 object-cover rounded-lg shadow-lg"
                          loading="lazy"
                          onError={e => {
                            e.currentTarget.src =
                              'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image';
                          }}
                        />
                      </td>
                      <td className="px-2 sm:px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-white break-words">
                            {anime.title}
                          </span>
                          {anime.status && (
                            <span
                              className={`self-start px-2 py-0.5 text-xs rounded-full ${
                                anime.status === 'Ongoing'
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {anime.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-purple-300">
                        {anime.contentType || 'Anime'}
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        {anime.subDubStatus && (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              anime.subDubStatus === 'Hindi Dub'
                                ? 'bg-red-600/80 text-white'
                                : anime.subDubStatus === 'Hindi Sub'
                                ? 'bg-orange-600/80 text-white'
                                : anime.subDubStatus === 'English Sub'
                                ? 'bg-blue-600/80 text-white'
                                : 'bg-purple-600/80 text-white'
                            }`}
                          >
                            {anime.subDubStatus}
                          </span>
                        )}
                      </td>
                      {isMainAdmin && (
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          {(!anime.createdBy || anime.createdBy === 'admin') ? (
                            <span className="text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25 whitespace-nowrap">
                              Main Admin
                            </span>
                          ) : (
                            <span
                              className="text-xs px-2 py-1 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25 whitespace-nowrap"
                              title={`Created by sub-admin: ${anime.createdByUsername}`}
                            >
                            {anime.createdByUsername || 'Sub-Admin'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={anime.totalEpisodes ?? 0}
                          onChange={e => updateLocalField(anime._id, 'totalEpisodes', parseInt(e.target.value) || 0)}
                          className="w-14 sm:w-16 px-1.5 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        />
                      </td>
                      <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={anime.currentEpisode ?? 0}
                          onChange={e => updateLocalField(anime._id, 'currentEpisode', parseInt(e.target.value) || 0)}
                          className="w-14 sm:w-16 px-1.5 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        />
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() =>
                              handleUpdate(
                                anime._id,
                                anime.totalEpisodes,
                                anime.currentEpisode
                              )
                            }
                            disabled={savingId === anime._id}
                            className="px-2 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-lg text-indigo-200 text-xs font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingId === anime._id ? (
                              <>
                                <div className="animate-spin h-3 w-3 border-2 border-indigo-200 border-t-transparent rounded-full"></div>
                                <span className="hidden sm:inline">Saving...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                  />
                                </svg>
                                <span className="hidden sm:inline">Save</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleSync(anime._id, anime.title)}
                            disabled={syncModalAnime?.id === anime._id && syncModalLoading}
                            className="px-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg text-emerald-200 text-xs font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {syncModalAnime?.id === anime._id && syncModalLoading ? (
                              <>
                                <div className="animate-spin h-3 w-3 border-2 border-emerald-200 border-t-transparent rounded-full"></div>
                                <span className="hidden sm:inline">Loading...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                <span className="hidden sm:inline">Sync</span>
                              </>
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

      {filteredList.length > 0 && (
        <div className="text-sm text-white/40 text-right">
          Showing {filteredList.length} of {animeList.length} anime
        </div>
      )}

      {/* Page-selection modal */}
      {syncModalAnime && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => !syncModalLoading && setSyncModalAnime(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Kaunse Page Se Sync Karein?</h3>
            <p className="text-xs text-white/50 mb-4">
              <span className="text-white font-medium">"{syncModalAnime.title}"</span> ke {syncModalPages.length} download pages hain. Sirf usi page ka episode number use hoga jo aap select karoge.
            </p>

            {syncModalLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
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
                      className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">Page {idx + 1}</p>
                        <p className="text-[11px] text-white/40 truncate">{page.slug}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {watchLinks.length} watch links
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                          Max Ep: {maxEp || '—'}
                        </span>
                        {confirmingPageId === page._id && (
                          <div className="w-3 h-3 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setSyncModalAnime(null)}
              disabled={syncModalLoading}
              className="w-full mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
      `}</style>
    </div>
  );
};

export default EpisodeStatusManager;