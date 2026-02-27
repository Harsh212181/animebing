 // src/components/admin/EpisodeStatusManager.tsx
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700/50 text-red-200 p-4 rounded-lg">
        <p className="font-semibold">Error loading anime:</p>
        <p>{error}</p>
        <button
          onClick={fetchAnime}
          className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-300">Episode Status Manager</h2>
        
        {/* Filter Controls */}
        <div className="flex flex-wrap gap-3">
          {/* Content Type Filter */}
          <select
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-purple-900/30 border border-purple-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="px-3 py-2 bg-purple-900/30 border border-purple-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Status</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Complete">Complete</option>
          </select>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search anime..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 px-4 py-2 bg-purple-900/30 border border-purple-700 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-purple-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="text-center py-12 text-purple-400 bg-purple-900/20 rounded-lg">
          {searchTerm || contentTypeFilter !== 'All' || statusFilter !== 'All' 
            ? 'No anime match your filters.' 
            : 'No anime found.'}
        </div>
      ) : (
        <div className="overflow-x-auto bg-purple-900/30 rounded-xl border border-purple-700/50">
          <table className="min-w-full divide-y divide-purple-700">
            <thead className="bg-purple-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Total Episodes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Current Episode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-700">
              {filteredList.map((anime) => (
                <tr key={anime._id} className="hover:bg-purple-800/20 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <img
                      src={anime.thumbnail || 'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image'}
                      alt={anime.title}
                      className="w-19 h-20 object-cover rounded"   
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image';
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {anime.title}
                    {anime.status && (
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        anime.status === 'Ongoing' ? 'bg-green-600/30 text-green-300' : 'bg-blue-600/30 text-blue-300'
                      }`}>
                        {anime.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-300">
                    {anime.contentType || 'Anime'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                      className="w-20 px-2 py-1 bg-purple-900/50 border border-purple-700 rounded text-white text-center"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                      className="w-20 px-2 py-1 bg-purple-900/50 border border-purple-700 rounded text-white text-center"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(anime._id, anime.totalEpisodes, anime.currentEpisode)}
                        disabled={savingId === anime._id}
                        className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-md text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingId === anime._id ? (
                          <span className="flex items-center gap-1">
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                            Saving...
                          </span>
                        ) : 'Save'}
                      </button>
                      <button
                        onClick={() => handleSync(anime._id)}
                        disabled={syncingId === anime._id}
                        className="px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-md text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncingId === anime._id ? (
                          <span className="flex items-center gap-1">
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                            Syncing...
                          </span>
                        ) : 'Sync'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EpisodeStatusManager;