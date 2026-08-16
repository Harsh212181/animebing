 // src/components/admin/EpisodeStatusManager.tsx – Redesigned with pill‑button filters + Sub/Dub badge + Creator badge
import React, { useState, useEffect } from 'react';
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
  subDubStatus?: string; // e.g. 'Hindi Dub', 'Hindi Sub', 'English Sub' …
  createdBy?: string;            // 👈 NEW
  createdByUsername?: string;    // 👈 NEW
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
  isMainAdmin?: boolean;   // 👈 NEW
}

const EpisodeStatusManager: React.FC<EpisodeStatusManagerProps> = ({ token: tokenProp, isMainAdmin = false }) => {
  // Token resolver: prop first, then fallback to localStorage (for main admin)
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [filteredList, setFilteredList] = useState<Anime[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'Ongoing' | 'Complete'
  >('all');
  const [subDubFilter, setSubDubFilter] = useState<
    'all' | 'Hindi Sub' | 'Hindi Dub' | 'English Sub'
  >('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'admin' | 'subadmin'>('all');   // 👈 NEW
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ✅ NEW — Page-selection modal states
  const [syncModalAnime, setSyncModalAnime] = useState<{ id: string; title: string } | null>(null);
  const [syncModalPages, setSyncModalPages] = useState<DownloadPage[]>([]);
  const [syncModalLoading, setSyncModalLoading] = useState(false);
  const [confirmingPageId, setConfirmingPageId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnime();
  }, []);

  // Apply filters
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

    // 👇 NEW — creator filter (sirf main admin ke liye meaningful)
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

  // ✅ NEW — ab ye sirf pages fetch karke modal kholega
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

      // Agar sirf ek hi page hai, to seedha usi se sync karo — ambiguity hi nahi
      if (pages.length === 1) {
        await syncWithSpecificPage(id, pages[0]);
        setSyncModalAnime(null);
        return;
      }

      // Multiple pages — user ko choose karne do
      setSyncModalPages(pages);
    } catch (err: any) {
      console.error('Sync fetch failed', err);
      toast.error('Failed to load pages: ' + (err.response?.data?.error || err.message));
      setSyncModalAnime(null);
    } finally {
      setSyncModalLoading(false);
    }
  };

  // ✅ NEW — ek specific page ke hisaab se sync karta hai, saare pages ka combined max nahi
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-lg">Loading anime list...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl">
          <svg
            className="w-8 h-8 text-purple-400"
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
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Episode Status Manager
        </h1>
      </div>

      {error && (
        <div className="relative p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-sm text-rose-200 flex items-center gap-3 shadow-lg shadow-rose-500/5">
          <svg
            className="w-5 h-5 text-rose-400"
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

      {/* Filter bar – Pill‑button style */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Content Type */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Type:</span>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'Movie', ...CONTENT_TYPE_OPTIONS] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setContentTypeFilter(t)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    contentTypeFilter === t
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Status:</span>
            <div className="flex gap-1">
              {(['all', 'Ongoing', 'Complete'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Sub/Dub */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Sub/Dub:</span>
            <div className="flex gap-1">
              {(['all', 'Hindi Sub', 'Hindi Dub', 'English Sub'] as const).map(
                s => (
                  <button
                    key={s}
                    onClick={() => setSubDubFilter(s)}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                      subDubFilter === s
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                )
              )}
            </div>
          </div>

          {/* 👇 NEW — Creator filter, sirf main admin ko dikhta hai */}
          {isMainAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/60">Creator:</span>
              <div className="flex gap-1">
                {(['all', 'admin', 'subadmin'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCreatorFilter(c)}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                      creatorFilter === c
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {c === 'all' ? 'All' : c === 'admin' ? 'Main Admin' : 'Sub-Admin'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative ml-auto">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-48 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 pl-8"
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

        {/* Clear filters & count */}
        <div className="text-xs text-white/40 mt-3 flex items-center gap-2">
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

      {/* Anime Table – glass card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
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
                {/* Sub/Dub column */}
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Sub/Dub
                </th>
                {/* 👇 NEW — Creator column, sirf main admin ko dikhta hai */}
                {isMainAdmin && (
                  <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Creator
                  </th>
                )}
                {/* Total and Current columns with reduced width */}
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
              {filteredList.length === 0 ? (
                <tr>
                  <td
                    colSpan={isMainAdmin ? 8 : 7}
                    className="px-6 py-12 text-center text-white/40"
                  >
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
                  </td>
                </tr>
              ) : (
                filteredList.map(anime => (
                  <tr
                    key={anime._id}
                    className="hover:bg-white/5 transition"
                  >
                    {/* Image cell with larger image */}
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
                    {/* Sub/Dub badge */}
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
                    {/* 👇 NEW — Creator badge, sirf main admin ko dikhta hai */}
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
                    {/* Total and Current with reduced padding & input size */}
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={anime.totalEpisodes ?? 0}
                        onChange={e => {
                          const newTotal = parseInt(e.target.value) || 0;
                          setAnimeList(prev =>
                            prev.map(a =>
                              a._id === anime._id
                                ? { ...a, totalEpisodes: newTotal }
                                : a
                            )
                          );
                        }}
                        className="w-14 sm:w-16 px-1.5 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={anime.currentEpisode ?? 0}
                        onChange={e => {
                          const newCurrent = parseInt(e.target.value) || 0;
                          setAnimeList(prev =>
                            prev.map(a =>
                              a._id === anime._id
                                ? { ...a, currentEpisode: newCurrent }
                                : a
                            )
                          );
                        }}
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
                        {/* ✅ UPDATED — Sync button onClick + disabled state */}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredList.length > 0 && (
        <div className="text-sm text-white/40 text-right">
          Showing {filteredList.length} of {animeList.length} anime
        </div>
      )}

      {/* ✅ NEW — Page-selection modal */}
      {syncModalAnime && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !syncModalLoading && setSyncModalAnime(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl"
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
    </div>
  );
};

export default EpisodeStatusManager;