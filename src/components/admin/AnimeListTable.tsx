 import React, { useState, useEffect } from 'react';
import type { Anime } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';
import toast from 'react-hot-toast'; // ✅ using react-hot-toast

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';
const token = localStorage.getItem('adminToken') || '';

interface AnimeListTableProps {
  animeList?: Anime[];
  onRemoveFromPartner?: (animeId: string) => void;
  showRemoveButton?: boolean;
  isLoading?: boolean;
}

const AnimeListTable: React.FC<AnimeListTableProps> = ({
  animeList: propAnimeList,
  onRemoveFromPartner,
  showRemoveButton = false,
  isLoading: propIsLoading = false,
}) => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [filteredAnimes, setFilteredAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ongoing' | 'Complete'>('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<'All' | 'Anime' | 'Movie' | 'Manga'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAnimeId, setEditingAnimeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ animeId: string; animeTitle: string } | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as Anime['subDubStatus'],
    genreList: [''],
    status: 'Ongoing',
    contentType: 'Anime' as 'Anime' | 'Movie' | 'Manga',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    slug: '',
  });

  const isPartnerMode = propAnimeList !== undefined;

  // Initialize or update animes when propAnimeList changes (partner mode)
  useEffect(() => {
    if (isPartnerMode && propAnimeList) {
      setAnimes(propAnimeList);
      setFilteredAnimes(propAnimeList);
      setLoading(false);
      setError('');
    }
  }, [propAnimeList, isPartnerMode]);

  // Fetch animes (only in normal admin mode)
  useEffect(() => {
    if (isPartnerMode) return;

    const fetchAnimes = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'All') params.append('status', statusFilter);
        if (contentTypeFilter !== 'All') params.append('contentType', contentTypeFilter);

        const url = `${API_BASE}/admin/protected/anime-list${params.toString() ? `?${params.toString()}` : ''}`;
        const { data } = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const animeData = data.map((a: any) => ({
          ...a,
          id: a._id,
          seoTitle: a.seoTitle || '',
          seoDescription: a.seoDescription || '',
          seoKeywords: a.seoKeywords || '',
          slug: a.slug || '',
          episodes: a.episodes || [],
        }));

        setAnimes(animeData);
        setFilteredAnimes(animeData);
      } catch (err: any) {
        console.error('Error fetching animes:', err);
        setError(err.response?.data?.error || 'Failed to load anime list');
      } finally {
        setLoading(false);
      }
    };

    fetchAnimes();
  }, [statusFilter, contentTypeFilter, isPartnerMode]);

  // Search filtering
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAnimes(animes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = animes.filter(
        (anime) =>
          anime.title.toLowerCase().includes(query) ||
          anime.genreList.some((genre) => genre.toLowerCase().includes(query)) ||
          anime.subDubStatus.toLowerCase().includes(query) ||
          anime.contentType.toLowerCase().includes(query) ||
          (anime.seoTitle && anime.seoTitle.toLowerCase().includes(query)) ||
          (anime.seoKeywords && anime.seoKeywords.toLowerCase().includes(query)) ||
          (anime.slug && anime.slug.toLowerCase().includes(query))
      );
      setFilteredAnimes(filtered);
    }
  }, [searchQuery, animes]);

  const handleDelete = (id: string) => {
    if (isPartnerMode) return;
    const animeTitle = animes.find((a) => a.id === id)?.title || 'this anime';
    setDeleteConfirm({ animeId: id, animeTitle });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { animeId } = deleteConfirm;
    const toastId = toast.loading('Deleting anime...');
    try {
      await axios.delete(`${API_BASE}/admin/protected/delete-anime`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id: animeId },
      });
      setEditingAnimeId(null);
      // Refresh list
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (contentTypeFilter !== 'All') params.append('contentType', contentTypeFilter);
      const url = `${API_BASE}/admin/protected/anime-list${params.toString() ? `?${params.toString()}` : ''}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const animeData = data.map((a: any) => ({
        ...a,
        id: a._id,
        seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '',
        seoKeywords: a.seoKeywords || '',
        slug: a.slug || '',
        episodes: a.episodes || [],
      }));
      setAnimes(animeData);
      setFilteredAnimes(animeData);
      toast.success('✅ Anime deleted successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error || 'Delete failed. Please try again.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleEdit = (anime: Anime) => {
    if (isPartnerMode) return;
    if (editingAnimeId === anime.id) {
      setEditingAnimeId(null);
    } else {
      setEditingAnimeId(anime.id);
      setEditForm({
        title: anime.title,
        description: anime.description || '',
        thumbnail: anime.thumbnail || '',
        releaseYear: anime.releaseYear || new Date().getFullYear(),
        subDubStatus: anime.subDubStatus,
        genreList: anime.genreList || [''],
        status: anime.status || 'Ongoing',
        contentType: anime.contentType || 'Anime',
        seoTitle: anime.seoTitle || '',
        seoDescription: anime.seoDescription || '',
        seoKeywords: anime.seoKeywords || '',
        slug: anime.slug || '',
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimeId || isPartnerMode) return;

    const toastId = toast.loading('Saving changes...');
    try {
      await axios.put(`${API_BASE}/admin/protected/edit-anime/${editingAnimeId}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('✅ Anime updated successfully! SEO data saved.', { id: toastId });
      setEditingAnimeId(null);

      // Refresh list
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (contentTypeFilter !== 'All') params.append('contentType', contentTypeFilter);
      const url = `${API_BASE}/admin/protected/anime-list${params.toString() ? `?${params.toString()}` : ''}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const animeData = data.map((a: any) => ({
        ...a,
        id: a._id,
        seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '',
        seoKeywords: a.seoKeywords || '',
        slug: a.slug || '',
        episodes: a.episodes || [],
      }));
      setAnimes(animeData);
      setFilteredAnimes(animeData);
    } catch (err: any) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.error || 'Update failed. Please try again.', { id: toastId });
    }
  };

  const handleCancelEdit = () => {
    setEditingAnimeId(null);
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const genres = e.target.value.split(',').map((g) => g.trim()).filter((g) => g);
    setEditForm({ ...editForm, genreList: genres.length ? genres : ['Action'] });
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditForm({ ...editForm, title: newTitle });

    if (!editForm.slug && newTitle.trim()) {
      const generatedSlug = generateSlug(newTitle);
      setEditForm((prev) => ({
        ...prev,
        slug: generatedSlug,
        seoTitle: prev.seoTitle || `Watch ${newTitle} Online in ${prev.subDubStatus} | AnimeBing`,
      }));
    }
  };

  const generateSlug = (title: string): string => {
    if (!title.trim()) return '';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSubDubStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Anime['subDubStatus'];
    setEditForm({ ...editForm, subDubStatus: newStatus });

    if (editForm.title.trim()) {
      setEditForm((prev) => ({
        ...prev,
        seoTitle: `Watch ${prev.title} Online in ${newStatus} | AnimeBing`,
      }));
    }
  };

  const generateFullSEO = (): string => {
    if (!editForm.title.trim()) {
      return 'Please enter a title first';
    }

    const keywords = [];
    keywords.push(
      `${editForm.title} anime`,
      `watch ${editForm.title} online`,
      `${editForm.title} ${editForm.subDubStatus.toLowerCase()}`,
      `${editForm.title} free download`
    );

    if (editForm.genreList && editForm.genreList.length > 0) {
      editForm.genreList.forEach((genre: string) => {
        keywords.push(
          `${genre.toLowerCase()} anime`,
          `${editForm.title} ${genre.toLowerCase()}`,
          `${genre.toLowerCase()} anime in hindi`
        );
      });
    }

    const statuses = editForm.subDubStatus.toLowerCase().split(',').map((s) => s.trim());

    if (statuses.includes('hindi dub')) {
      keywords.push(
        'hindi dubbed anime',
        'anime in hindi',
        'hindi dub',
        `${editForm.title} hindi dubbed`,
        'watch anime in hindi'
      );
    }

    if (statuses.includes('hindi sub')) {
      keywords.push(
        'hindi subbed anime',
        'anime with hindi subtitles',
        'hindi sub',
        `${editForm.title} hindi subbed`,
        'hindi subtitles anime'
      );
    }

    if (statuses.includes('english sub')) {
      keywords.push(
        'english subbed anime',
        'anime in english',
        'english sub',
        `${editForm.title} english sub`,
        'english subtitles anime'
      );
    }

    if (editForm.contentType === 'Movie') {
      keywords.push(
        `${editForm.title} movie`,
        `watch ${editForm.title} movie online`,
        `${editForm.title} anime movie`,
        'anime movies',
        'full anime movie'
      );
    } else if (editForm.contentType === 'Manga') {
      keywords.push(
        `${editForm.title} manga`,
        `read ${editForm.title} manga online`,
        `${editForm.title} manga chapters`,
        'read manga online',
        'manga in hindi'
      );
    } else {
      keywords.push(
        `${editForm.title} episodes`,
        `watch ${editForm.title} episodes`,
        `${editForm.title} all episodes`,
        'anime episodes',
        'hindi dubbed episodes'
      );
    }

    keywords.push('animebing', 'animebing.in', 'anime streaming site', 'free anime downloads');

    return [...new Set(keywords)].join(', ');
  };

  const handleAutoGenerateSEO = () => {
    if (!editForm.title.trim()) {
      toast.error('Please enter a title first');
      return;
    }

    const generatedSlug = generateSlug(editForm.title);
    const seoKeywords = generateFullSEO();

    setEditForm((prev) => ({
      ...prev,
      seoTitle:
        prev.seoTitle || `Watch ${prev.title} Online in ${prev.subDubStatus} | AnimeBing`,
      seoDescription:
        prev.seoDescription ||
        `Watch ${prev.title} online in ${prev.subDubStatus}. HD quality streaming and downloads. ${
          prev.contentType === 'Movie' ? 'Full movie available' : 'All episodes available'
        } on AnimeBing.`,
      seoKeywords: prev.seoKeywords || seoKeywords,
      slug: prev.slug || generatedSlug,
    }));

    toast.success('✅ SEO data auto-generated successfully!');
  };

  const getSEOStatus = (anime: Anime): { text: string; color: string; bgColor: string } => {
    if (!anime.seoTitle && !anime.seoDescription && !anime.slug) {
      return { text: 'No SEO', color: 'text-red-400', bgColor: 'bg-red-600/20' };
    }
    if (!anime.slug) {
      return { text: 'Missing Slug', color: 'text-orange-400', bgColor: 'bg-orange-600/20' };
    }
    if (anime.seoTitle && anime.seoDescription && anime.slug) {
      return { text: 'SEO ✓', color: 'text-green-400', bgColor: 'bg-green-600/20' };
    }
    return { text: 'Partial SEO', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' };
  };

  if ((!isPartnerMode && loading) || (isPartnerMode && propIsLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-lg">Loading anime list...</p>
      </div>
    );
  }

  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

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
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Anime List Manager
        </h1>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Delete</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete "{deleteConfirm.animeTitle}"? This will also delete all episodes/chapters.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition pr-8"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Refresh Button (only in normal mode) */}
            {!isPartnerMode && (
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (statusFilter !== 'All') params.append('status', statusFilter);
                  if (contentTypeFilter !== 'All') params.append('contentType', contentTypeFilter);
                  const url = `${API_BASE}/admin/protected/anime-list${params.toString() ? `?${params.toString()}` : ''}`;
                  axios
                    .get(url, { headers: { Authorization: `Bearer ${token}` } })
                    .then(({ data }) => {
                      const animeData = data.map((a: any) => ({
                        ...a,
                        id: a._id,
                        seoTitle: a.seoTitle || '',
                        seoDescription: a.seoDescription || '',
                        seoKeywords: a.seoKeywords || '',
                        slug: a.slug || '',
                        episodes: a.episodes || [],
                      }));
                      setAnimes(animeData);
                      setFilteredAnimes(animeData);
                      toast.success('List refreshed');
                    })
                    .catch(() => toast.error('Failed to refresh'));
                }}
                className="px-4 py-2.5 bg-purple-600/80 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            )}
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
                  Year
                </th>
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Sub/Dub
                </th>
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Episodes
                </th>
                {!isPartnerMode && (
                  <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    SEO Status
                  </th>
                )}
                <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredAnimes.length === 0 ? (
                <tr>
                  <td colSpan={isPartnerMode ? 8 : 9} className="px-6 py-12 text-center text-white/40">
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
                    <p className="mt-4 text-white/60 text-lg">No anime match your filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAnimes.map((anime) => {
                  const seoStatus = !isPartnerMode ? getSEOStatus(anime) : null;
                  return (
                    <React.Fragment key={anime.id}>
                      <tr
                        className={`hover:bg-white/5 transition ${
                          editingAnimeId === anime.id ? 'bg-white/10' : ''
                        }`}
                      >
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
                          {anime.contentType}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-white/70 text-center">
                          {anime.releaseYear || 'N/A'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              anime.status === 'Complete'
                                ? 'bg-green-600/80 text-white'
                                : 'bg-yellow-600/80 text-white'
                            }`}
                          >
                            {anime.status || 'Ongoing'}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                              anime.subDubStatus === 'Hindi Dub'
                                ? 'bg-red-600/80 text-white'
                                : anime.subDubStatus === 'Hindi Sub'
                                ? 'bg-orange-600/80 text-white'
                                : anime.subDubStatus === 'English Sub'
                                ? 'bg-blue-600/80 text-white'
                                : 'bg-purple-600/80 text-white'
                            }`}
                            style={{ minWidth: '80px', display: 'inline-block', textAlign: 'center' }}
                          >
                            {anime.subDubStatus}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-white/70 text-center">
                          <span className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded text-xs whitespace-nowrap">
                            {anime.episodes?.length || 0} episodes
                          </span>
                        </td>
                        {!isPartnerMode && (
                          <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                            {seoStatus && (
                              <span
                                className={`${seoStatus.bgColor} ${seoStatus.color} px-2 py-1 rounded text-xs whitespace-nowrap`}
                              >
                                {seoStatus.text}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col sm:flex-row gap-2">
                            {showRemoveButton && onRemoveFromPartner ? (
                              <button
                                onClick={() => onRemoveFromPartner(anime.id)}
                                className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium transition-all flex items-center justify-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                Remove
                              </button>
                            ) : (
                              !isPartnerMode && (
                                <>
                                  <button
                                    onClick={() => handleEdit(anime)}
                                    className={`px-2 py-1.5 ${
                                      editingAnimeId === anime.id
                                        ? 'bg-yellow-500/20 hover:bg-yellow-500/40 border-yellow-500/30 text-yellow-200'
                                        : 'bg-indigo-500/20 hover:bg-indigo-500/40 border-indigo-500/30 text-indigo-200'
                                    } border rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1`}
                                  >
                                    {editingAnimeId === anime.id ? (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                        Cancel
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                          />
                                        </svg>
                                        Edit SEO
                                      </>
                                    )}
                                  </button>
                                  {editingAnimeId !== anime.id && (
                                    <button
                                      onClick={() => handleDelete(anime.id)}
                                      className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium transition-all flex items-center justify-center gap-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      Delete
                                    </button>
                                  )}
                                </>
                              )
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Edit form row – only in normal mode */}
                      {!isPartnerMode && editingAnimeId === anime.id && (
                        <tr className="bg-white/5">
                          <td colSpan={9} className="p-4">
                            <div className="border-l-4 border-blue-500 pl-4 py-2">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                  <svg
                                    className="w-5 h-5 text-blue-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                  Edit {anime.contentType}: {anime.title}
                                </h4>
                                <button
                                  onClick={handleAutoGenerateSEO}
                                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex items-center gap-1"
                                >
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
                                      d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                  </svg>
                                  Auto-Generate SEO
                                </button>
                              </div>

                              <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Title *
                                    </label>
                                    <input
                                      type="text"
                                      value={editForm.title}
                                      onChange={handleTitleChange}
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Content Type
                                    </label>
                                    <select
                                      value={editForm.contentType}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          contentType: e.target.value as 'Anime' | 'Movie' | 'Manga',
                                        })
                                      }
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                    >
                                      <option value="Anime">Anime Series</option>
                                      <option value="Movie">Movie</option>
                                      <option value="Manga">Manga</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Release Year
                                    </label>
                                    <input
                                      type="number"
                                      value={editForm.releaseYear}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, releaseYear: Number(e.target.value) })
                                      }
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                      min="1900"
                                      max="2030"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Sub/Dub Status
                                    </label>
                                    <select
                                      value={editForm.subDubStatus}
                                      onChange={handleSubDubStatusChange}
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                    >
                                      <option value="Hindi Dub">Hindi Dub</option>
                                      <option value="Hindi Sub">Hindi Sub</option>
                                      <option value="English Sub">English Sub</option>
                                      <option value="Both">Both</option>
                                      <option value="Subbed">Subbed</option>
                                      <option value="Dubbed">Dubbed</option>
                                      <option value="Sub & Dub">Sub & Dub</option>
                                      <option value="Dual Audio">Dual Audio</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Status
                                    </label>
                                    <select
                                      value={editForm.status}
                                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                    >
                                      <option value="Ongoing">Ongoing</option>
                                      <option value="Complete">Complete</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      Thumbnail URL
                                    </label>
                                    <input
                                      type="url"
                                      value={editForm.thumbnail}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, thumbnail: e.target.value })
                                      }
                                      className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                      placeholder="https://res.cloudinary.com/..."
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Description
                                  </label>
                                  <textarea
                                    value={editForm.description}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, description: e.target.value })
                                    }
                                    className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition h-20"
                                    placeholder="Brief description of the anime..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Genres (comma separated)
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.genreList.join(', ')}
                                    onChange={handleGenreChange}
                                    className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                    placeholder="Action, Adventure, Fantasy"
                                  />
                                </div>

                                {/* SEO SECTION */}
                                <div className="mt-6 pt-4 border-t border-white/10">
                                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <svg
                                      className="w-5 h-5 text-green-400"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                      />
                                    </svg>
                                    SEO Settings (For Google Search)
                                  </h4>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        SEO Title
                                        <span
                                          className={`text-xs ml-2 ${
                                            editForm.seoTitle.length > 60 ? 'text-red-400' : 'text-green-400'
                                          }`}
                                        >
                                          ({editForm.seoTitle.length}/60)
                                        </span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.seoTitle}
                                        onChange={(e) =>
                                          setEditForm({ ...editForm, seoTitle: e.target.value })
                                        }
                                        className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition"
                                        placeholder="Watch {Title} Online in {Language} | AnimeBing"
                                        maxLength={60}
                                      />
                                      <p className="text-xs text-slate-400 mt-1">
                                        Appears in Google search results
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        URL Slug
                                        <span className="text-xs text-blue-400 ml-2">
                                          animebing.in/detail/{editForm.slug || 'your-slug'}
                                        </span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.slug}
                                        onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                                        className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                                        placeholder="naruto-shippuden-hindi-dub"
                                      />
                                      <p className="text-xs text-slate-400 mt-1">
                                        SEO-friendly URL (lowercase, hyphens)
                                      </p>
                                    </div>

                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        SEO Description
                                        <span
                                          className={`text-xs ml-2 ${
                                            editForm.seoDescription.length > 160 ? 'text-red-400' : 'text-green-400'
                                          }`}
                                        >
                                          ({editForm.seoDescription.length}/160)
                                        </span>
                                      </label>
                                      <textarea
                                        value={editForm.seoDescription}
                                        onChange={(e) =>
                                          setEditForm({ ...editForm, seoDescription: e.target.value })
                                        }
                                        className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition h-20"
                                        placeholder="Watch {Title} online in {Language}. HD quality streaming and downloads. All episodes available."
                                        maxLength={160}
                                      />
                                      <p className="text-xs text-slate-400 mt-1">
                                        Appears below the title in Google search results
                                      </p>
                                    </div>

                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        SEO Keywords (Comma separated)
                                        <span className="text-xs text-slate-400 ml-2">
                                          Important for search rankings
                                        </span>
                                      </label>
                                      <textarea
                                        value={editForm.seoKeywords}
                                        onChange={(e) =>
                                          setEditForm({ ...editForm, seoKeywords: e.target.value })
                                        }
                                        className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition h-20"
                                        placeholder="naruto shippuden hindi dub, watch naruto shippuden online, naruto anime in hindi, action anime, adventure anime"
                                      />
                                      <p className="text-xs text-slate-400 mt-1">
                                        Keywords that users might search for on Google
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <button
                                    type="submit"
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    Save Changes & SEO
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredAnimes.length > 0 && (
        <div className="text-sm text-white/40 text-right">
          Showing {filteredAnimes.length} of {animes.length} anime
        </div>
      )}
    </div>
  );
};

export default AnimeListTable;