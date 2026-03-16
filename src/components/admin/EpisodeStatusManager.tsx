 // src/components/admin/EpisodeStatusManager.tsx – Redesigned with glass‑morphism
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Helper to get API base (same as AdminDashboard)
const getApiBase = () => {
  if (typeof window === 'undefined') return 'https://animabing.onrender.com/api';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'http://localhost:3000/api' : 'https://animabing.onrender.com/api';
};

const API_BASE = getApiBase();

interface Anime {
  _id: string;
  title: string;
  thumbnail?: string;
  totalEpisodes: number;
  currentEpisode: number;
  contentType: string;
  status: string;
}

const EpisodeStatusManager: React.FC = () => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [filteredList, setFilteredList] = useState<Anime[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<'All' | 'Anime' | 'Movie' | 'Manga'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ongoing' | 'Complete'>('All');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    fetchAnime();
  }, []);

  // Apply filters whenever animeList, searchTerm, contentTypeFilter, or statusFilter change
  useEffect(() => {
    let filtered = animeList;

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(anime => anime.title.toLowerCase().includes(term));
    }

    // Content type filter
    if (contentTypeFilter !== 'All') {
      filtered = filtered.filter(anime => anime.contentType === contentTypeFilter);
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(anime => anime.status === statusFilter);
    }

    setFilteredList(filtered);
  }, [searchTerm, animeList, contentTypeFilter, statusFilter]);

  const fetchAnime = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnimeList(data);
      setFilteredList(data);
    } catch (err: any) {
      console.error('Failed to fetch anime list', err);
      setError(err.response?.data?.error || err.message || 'Failed to load anime');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, totalEpisodes: number, currentEpisode: number) => {
    setSavingId(id);
    setError('');
    try {
      await axios.patch(
        `${API_BASE}/admin/protected/anime/${id}/episode-status`,
        { totalEpisodes, currentEpisode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update local state
      setAnimeList(prev =>
        prev.map(a => (a._id === id ? { ...a, totalEpisodes, currentEpisode } : a))
      );
      alert('Episode status updated successfully!');
    } catch (err: any) {
      console.error('Update failed', err);
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setError('');
    try {
      const { data } = await axios.post(
        `${API_BASE}/admin/protected/anime/${id}/sync-episode-count`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update the anime in list with new currentEpisode from response
      setAnimeList(prev =>
        prev.map(a => (a._id === id ? { ...a, currentEpisode: data.anime.currentEpisode } : a))
      );
      alert(`Synced! Current episode set to ${data.anime.currentEpisode}`);
    } catch (err: any) {
      console.error('Sync failed', err);
      alert('Sync failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncingId(null);
    }
  };

  // Loading state
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
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Episode Status Manager
        </h1>
      </div>

      {/* Error display */}
      {error && (
        <div className="relative p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-sm text-rose-200 flex items-center gap-3 shadow-lg shadow-rose-500/5">
          <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Filter bar – glass card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
            Filters
          </h2>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            {/* Content Type Filter */}
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition appearance-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="Anime">Anime</option>
              <option value="Movie">Movie</option>
              <option value="Manga">Manga</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition appearance-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Complete">Complete</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search anime..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition pr-8"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
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
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
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
                  <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                    <svg className="w-16 h-16 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="mt-4 text-white/60 text-lg">No anime match your filters.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((anime) => (
                  <tr key={anime._id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                      <img
                        src={anime.thumbnail || 'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image'}
                        alt={anime.title}
                        className="w-12 h-16 sm:w-16 sm:h-20 object-cover rounded-lg shadow-lg"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image';
                        }}
                      />
                    </td>
                    <td className="px-2 sm:px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-white break-words">{anime.title}</span>
                        {anime.status && (
                          <span className={`self-start px-2 py-0.5 text-xs rounded-full ${
                            anime.status === 'Ongoing' 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {anime.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-purple-300">
                      {anime.contentType || 'Anime'}
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={anime.totalEpisodes ?? 0}
                        onChange={(e) => {
                          const newTotal = parseInt(e.target.value) || 0;
                          setAnimeList(prev =>
                            prev.map(a => a._id === anime._id ? { ...a, totalEpisodes: newTotal } : a)
                          );
                        }}
                        className="w-16 sm:w-20 px-2 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={anime.currentEpisode ?? 0}
                        onChange={(e) => {
                          const newCurrent = parseInt(e.target.value) || 0;
                          setAnimeList(prev =>
                            prev.map(a => a._id === anime._id ? { ...a, currentEpisode: newCurrent } : a)
                          );
                        }}
                        className="w-16 sm:w-20 px-2 py-2 bg-gray-800/60 border border-gray-700/80 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleUpdate(anime._id, anime.totalEpisodes, anime.currentEpisode)}
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
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                              </svg>
                              <span className="hidden sm:inline">Save</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSync(anime._id)}
                          disabled={syncingId === anime._id}
                          className="px-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg text-emerald-200 text-xs font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingId === anime._id ? (
                            <>
                              <div className="animate-spin h-3 w-3 border-2 border-emerald-200 border-t-transparent rounded-full"></div>
                              <span className="hidden sm:inline">Syncing...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

      {/* Summary – optional small footer */}
      {filteredList.length > 0 && (
        <div className="text-sm text-white/40 text-right">
          Showing {filteredList.length} of {animeList.length} anime
        </div>
      )}
    </div>
  );
};

export default EpisodeStatusManager;