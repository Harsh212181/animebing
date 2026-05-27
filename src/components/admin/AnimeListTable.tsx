 import React, { useState, useEffect, useMemo } from 'react';
import type { Anime } from '../../types';
import axios from 'axios';
import toast from 'react-hot-toast';
import { clearAnimeCache } from '../../../services/animeService';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';
const token = localStorage.getItem('adminToken') || '';

interface AnimeListTableProps {
  animeList?: Anime[];
  onRemoveFromPartner?: (animeId: string) => void;
  showRemoveButton?: boolean;
  isLoading?: boolean;
}

type AnimeWithId = Anime & { id: string };

const AnimeListTable: React.FC<AnimeListTableProps> = ({
  animeList: propAnimeList,
  onRemoveFromPartner,
  showRemoveButton = false,
  isLoading: propIsLoading = false,
}) => {
  const [animes, setAnimes] = useState<AnimeWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ✅ NEW: download page counts per animeId
  const [downloadPageCounts, setDownloadPageCounts] = useState<Record<string, number>>({});

  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'Anime' | 'Movie' | 'Manga'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ongoing' | 'Complete'>('all');
  const [subDubFilter, setSubDubFilter] = useState<'all' | 'Hindi Sub' | 'Hindi Dub' | 'English Sub'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

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

  const [hidingId, setHidingId] = useState<string | null>(null);
  const isPartnerMode = propAnimeList !== undefined;

  useEffect(() => {
    if (isPartnerMode && propAnimeList) {
      setAnimes(propAnimeList as AnimeWithId[]);
      setLoading(false);
      setError('');
    }
  }, [propAnimeList, isPartnerMode]);

  useEffect(() => {
    if (isPartnerMode) return;
    const fetchAnimes = async () => {
      setLoading(true);
      setError('');
      try {
        const url = `${API_BASE}/admin/protected/anime-list`;
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
          isHidden: a.isHidden || false,
        }));
        setAnimes(animeData as AnimeWithId[]);
      } catch (err: any) {
        console.error('Error fetching animes:', err);
        setError(err.response?.data?.error || 'Failed to load anime list');
      } finally {
        setLoading(false);
      }
    };
    fetchAnimes();
  }, [isPartnerMode]);

  // ✅ NEW: Fetch all download pages and count per animeId
  useEffect(() => {
    if (isPartnerMode) return;
    const fetchDownloadPageCounts = async () => {
      try {
        const authToken = localStorage.getItem('adminToken') || '';
        const { data } = await axios.get(`${API_BASE}/download-pages`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        // data = array of download pages, each has animeId._id (populated)
        const counts: Record<string, number> = {};
        data.forEach((page: any) => {
          const id = page.animeId?._id || page.animeId;
          if (id) {
            counts[id] = (counts[id] || 0) + 1;
          }
        });
        setDownloadPageCounts(counts);
      } catch (err) {
        // Silent fail — counts just show 0
        console.error('Could not fetch download page counts:', err);
      }
    };
    fetchDownloadPageCounts();
  }, [isPartnerMode]);

  const filteredAnimes = useMemo(() => {
    let result: AnimeWithId[] = animes;
    if (contentTypeFilter !== 'all') result = result.filter(a => a.contentType === contentTypeFilter);
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (subDubFilter !== 'all') result = result.filter(a => a.subDubStatus === subDubFilter);
    if (visibilityFilter === 'visible') result = result.filter(a => !a.isHidden);
    if (visibilityFilter === 'hidden') result = result.filter(a => a.isHidden);
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(query) ||
        (a.genreList ?? []).some(g => g.toLowerCase().includes(query)) ||
        a.subDubStatus.toLowerCase().includes(query) ||
        a.contentType.toLowerCase().includes(query) ||
        (a.seoTitle && a.seoTitle.toLowerCase().includes(query)) ||
        (a.seoKeywords && a.seoKeywords.toLowerCase().includes(query)) ||
        (a.slug && a.slug.toLowerCase().includes(query))
      );
    }
    return result;
  }, [animes, contentTypeFilter, statusFilter, subDubFilter, visibilityFilter, searchQuery]);

  const handleDelete = (id: string) => {
    if (isPartnerMode) return;
    const animeTitle = animes.find(a => a.id === id)?.title || 'this anime';
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
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const animeData = data.map((a: any) => ({
        ...a, id: a._id, seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '', seoKeywords: a.seoKeywords || '',
        slug: a.slug || '', episodes: a.episodes || [], isHidden: a.isHidden || false,
      }));
      setAnimes(animeData as AnimeWithId[]);
      clearAnimeCache();
      toast.success('✅ Anime deleted successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => setDeleteConfirm(null);

  const handleEdit = (anime: AnimeWithId) => {
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
      toast.success('✅ Anime updated successfully!', { id: toastId });
      setEditingAnimeId(null);
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const animeData = data.map((a: any) => ({
        ...a, id: a._id, seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '', seoKeywords: a.seoKeywords || '',
        slug: a.slug || '', episodes: a.episodes || [], isHidden: a.isHidden || false,
      }));
      setAnimes(animeData as AnimeWithId[]);
      clearAnimeCache();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed.', { id: toastId });
    }
  };

  const handleCancelEdit = () => setEditingAnimeId(null);

  const handleToggleHide = async (anime: AnimeWithId) => {
    const toastId = toast.loading(anime.isHidden ? 'Showing anime...' : 'Hiding anime...');
    setHidingId(anime.id);
    try {
      const authToken = localStorage.getItem('adminToken') || '';
      const hideUrl = `${API_BASE}/admin/protected/toggle-hide/${anime.id}`;

      await axios.patch(hideUrl, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      setAnimes(prev => prev.map(a =>
        a.id === anime.id ? { ...a, isHidden: !a.isHidden } : a
      ));

      clearAnimeCache();

      toast.success(
        anime.isHidden ? '✅ Anime is now visible!' : '🔒 Anime hidden from users!',
        { id: toastId }
      );
    } catch (err: any) {
      console.error('❌ Hide error:', err.response?.status, err.response?.data);
      toast.error(err.response?.data?.error || `Error ${err.response?.status}: Action failed`, { id: toastId });
    } finally {
      setHidingId(null);
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
    setEditForm({ ...editForm, genreList: genres.length ? genres : ['Action'] });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditForm({ ...editForm, title: newTitle });
    if (!editForm.slug && newTitle.trim()) {
      const generatedSlug = generateSlug(newTitle);
      setEditForm(prev => ({
        ...prev, slug: generatedSlug,
        seoTitle: prev.seoTitle || `Watch ${newTitle} Online in ${prev.subDubStatus} | AnimeBing`,
      }));
    }
  };

  const generateSlug = (title: string): string => {
    if (!title.trim()) return '';
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };

  const handleSubDubStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Anime['subDubStatus'];
    setEditForm({ ...editForm, subDubStatus: newStatus });
    if (editForm.title.trim()) {
      setEditForm(prev => ({ ...prev, seoTitle: `Watch ${prev.title} Online in ${newStatus} | AnimeBing` }));
    }
  };

  const generateFullSEO = (): string => {
    if (!editForm.title.trim()) return 'Please enter a title first';
    const keywords = [
      `${editForm.title} anime`, `watch ${editForm.title} online`,
      `${editForm.title} ${editForm.subDubStatus.toLowerCase()}`, `${editForm.title} free download`,
    ];
    if (editForm.genreList?.length > 0) {
      editForm.genreList.forEach(genre => {
        keywords.push(`${genre.toLowerCase()} anime`, `${editForm.title} ${genre.toLowerCase()}`);
      });
    }
    const statuses = editForm.subDubStatus.toLowerCase().split(',').map(s => s.trim());
    if (statuses.includes('hindi dub')) keywords.push('hindi dubbed anime', 'anime in hindi', 'hindi dub');
    if (statuses.includes('hindi sub')) keywords.push('hindi subbed anime', 'hindi sub');
    if (statuses.includes('english sub')) keywords.push('english subbed anime', 'english sub');
    if (editForm.contentType === 'Movie') keywords.push(`${editForm.title} movie`, 'anime movies');
    else if (editForm.contentType === 'Manga') keywords.push(`${editForm.title} manga`, 'read manga online');
    else keywords.push(`${editForm.title} episodes`, `${editForm.title} all episodes`);
    keywords.push('animebing', 'animebing.in', 'free anime downloads');
    return [...new Set(keywords)].join(', ');
  };

  const handleAutoGenerateSEO = () => {
    if (!editForm.title.trim()) { toast.error('Please enter a title first'); return; }
    const seoKeywords = generateFullSEO();
    setEditForm(prev => ({
      ...prev,
      seoTitle: prev.seoTitle || `Watch ${prev.title} Online in ${prev.subDubStatus} | AnimeBing`,
      seoDescription: prev.seoDescription || `Watch ${prev.title} online in ${prev.subDubStatus}. HD quality streaming and downloads.`,
      seoKeywords: prev.seoKeywords || seoKeywords,
      slug: prev.slug || generateSlug(prev.title),
    }));
    toast.success('✅ SEO data auto-generated!');
  };

  const getSEOStatus = (anime: AnimeWithId) => {
    if (!anime.seoTitle && !anime.seoDescription && !anime.slug) return { text: 'No SEO', color: 'text-red-400', bgColor: 'bg-red-600/20' };
    if (!anime.slug) return { text: 'No Slug', color: 'text-orange-400', bgColor: 'bg-orange-600/20' };
    if (anime.seoTitle && anime.seoDescription && anime.slug) return { text: 'SEO ✓', color: 'text-green-400', bgColor: 'bg-green-600/20' };
    return { text: 'Partial', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' };
  };

  if ((!isPartnerMode && loading) || (isPartnerMode && propIsLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-lg">Loading anime list...</p>
      </div>
    );
  }

  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div className="p-4 space-y-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl">
          <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Anime List Manager
        </h1>
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/20 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Delete</h3>
            <p className="text-slate-300 mb-6">Delete "{deleteConfirm.animeTitle}"? This will also delete all episodes/chapters.</p>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Type:</span>
            <div className="flex gap-1">
              {(['all', 'Anime', 'Movie', 'Manga'] as const).map(t => (
                <button key={t} onClick={() => setContentTypeFilter(t)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${contentTypeFilter === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Status:</span>
            <div className="flex gap-1">
              {(['all', 'Ongoing', 'Complete'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">Sub/Dub:</span>
            <div className="flex gap-1">
              {(['all', 'Hindi Sub', 'Hindi Dub', 'English Sub'] as const).map(s => (
                <button key={s} onClick={() => setSubDubFilter(s)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${subDubFilter === s ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          {/* ✅ NEW: Visibility filter — sirf admin mode mein */}
          {!isPartnerMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/60">Visibility:</span>
              <div className="flex gap-1">
                <button onClick={() => setVisibilityFilter('all')}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${visibilityFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  All
                </button>
                <button onClick={() => setVisibilityFilter('visible')}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${visibilityFilter === 'visible' ? 'bg-green-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  👁 Visible
                </button>
                <button onClick={() => setVisibilityFilter('hidden')}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${visibilityFilter === 'hidden' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  🔒 Hidden
                </button>
              </div>
            </div>
          )}
          <div className="relative ml-auto">
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 pl-8" />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="text-xs text-white/40 mt-3">
          {filteredAnimes.length} / {animes.length} anime
          {(contentTypeFilter !== 'all' || statusFilter !== 'all' || subDubFilter !== 'all' || visibilityFilter !== 'all') && (
            <button onClick={() => { setContentTypeFilter('all'); setStatusFilter('all'); setSubDubFilter('all'); setVisibilityFilter('all'); }}
              className="ml-2 text-purple-400 hover:text-purple-300 underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Img</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Title</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Year</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Sub/Dub</th>
                {/* ✅ NEW: Download Pages column — sirf admin mode mein */}
                {!isPartnerMode && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">DL Pages</th>
                )}
                {!isPartnerMode && <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">SEO</th>}
                {!isPartnerMode && <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Visibility</th>}
                <th className="px-3 py-3 text-left text-xs font-medium text-white/50 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredAnimes.length === 0 ? (
                <tr>
                  <td colSpan={isPartnerMode ? 7 : 10} className="px-6 py-12 text-center text-white/40">
                    No anime match your filters.
                  </td>
                </tr>
              ) : (
                filteredAnimes.map(anime => {
                  const seoStatus = !isPartnerMode ? getSEOStatus(anime) : null;
                  // ✅ NEW: is anime ke liye kitne download pages hain
                  const dlCount = downloadPageCounts[anime.id] || 0;
                  return (
                    <React.Fragment key={anime.id}>
                      <tr className={`hover:bg-white/5 transition ${editingAnimeId === anime.id ? 'bg-white/10' : ''}`}>

                        {/* Image */}
                        <td className="px-3 py-3">
                          <div className="w-14 h-18 rounded-lg overflow-hidden bg-gray-800 border border-white/10" style={{ minWidth: 56, height: 72 }}>
                            <img src={anime.thumbnail || 'https://via.placeholder.com/56x72/1e293b/64748b?text=NA'}
                              alt={anime.title} className="w-full h-full object-cover" loading="lazy"
                              onError={e => { e.currentTarget.src = 'https://via.placeholder.com/56x72/1e293b/64748b?text=NA'; }} />
                          </div>
                        </td>

                        {/* Title */}
                        <td className="px-3 py-3 max-w-[160px]">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-white leading-tight line-clamp-2">{anime.title}</span>
                            {anime.isHidden && (
                              <span className="self-start px-1.5 py-0.5 text-xs rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                🔒 Hidden
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-xs text-purple-300">{anime.contentType}</span>
                        </td>

                        {/* Year */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-xs text-white/60">{anime.releaseYear || 'N/A'}</span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${anime.status === 'Complete' ? 'bg-green-600/80 text-white' : 'bg-yellow-600/80 text-white'}`}>
                            {anime.status || 'Ongoing'}
                          </span>
                        </td>

                        {/* Sub/Dub */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                            anime.subDubStatus === 'Hindi Dub' ? 'bg-red-600/80 text-white' :
                            anime.subDubStatus === 'Hindi Sub' ? 'bg-orange-600/80 text-white' :
                            anime.subDubStatus === 'English Sub' ? 'bg-blue-600/80 text-white' :
                            'bg-purple-600/80 text-white'}`}>
                            {anime.subDubStatus}
                          </span>
                        </td>

                        {/* ✅ NEW: Download Pages count cell */}
                        {!isPartnerMode && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                              dlCount === 0
                                ? 'bg-red-600/20 text-red-300'
                                : dlCount < 5
                                ? 'bg-yellow-600/20 text-yellow-300'
                                : 'bg-emerald-600/20 text-emerald-300'
                            }`}>
                              {dlCount === 0 ? '—' : dlCount}
                            </span>
                          </td>
                        )}

                        {/* SEO */}
                        {!isPartnerMode && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            {seoStatus && (
                              <span className={`${seoStatus.bgColor} ${seoStatus.color} px-1.5 py-0.5 rounded text-xs`}>
                                {seoStatus.text}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Visibility */}
                        {!isPartnerMode && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleHide(anime)}
                              disabled={hidingId === anime.id}
                              className={`px-2 py-1.5 border rounded-lg text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50 ${
                                anime.isHidden
                                  ? 'bg-green-500/20 hover:bg-green-500/40 border-green-500/30 text-green-200'
                                  : 'bg-yellow-500/20 hover:bg-yellow-500/40 border-yellow-500/30 text-yellow-200'
                              }`}
                            >
                              {hidingId === anime.id ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                              ) : anime.isHidden ? (
                                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>Show</>
                              ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/></svg>Hide</>
                              )}
                            </button>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            {showRemoveButton && onRemoveFromPartner ? (
                              <button onClick={() => onRemoveFromPartner(anime.id)}
                                className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                Remove
                              </button>
                            ) : !isPartnerMode && (
                              <>
                                <button onClick={() => handleEdit(anime)}
                                  className={`px-2 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1 ${
                                    editingAnimeId === anime.id
                                      ? 'bg-yellow-500/20 hover:bg-yellow-500/40 border-yellow-500/30 text-yellow-200'
                                      : 'bg-indigo-500/20 hover:bg-indigo-500/40 border-indigo-500/30 text-indigo-200'
                                  }`}>
                                  {editingAnimeId === anime.id ? (
                                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>Cancel</>
                                  ) : (
                                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</>
                                  )}
                                </button>
                                {editingAnimeId !== anime.id && (
                                  <button onClick={() => handleDelete(anime.id)}
                                    className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Edit Form Row */}
                      {!isPartnerMode && editingAnimeId === anime.id && (
                        <tr className="bg-white/5">
                          <td colSpan={10} className="p-4">
                            <div className="border-l-4 border-blue-500 pl-4 py-2">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-base font-semibold text-white flex items-center gap-2">
                                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                  Edit: {anime.title}
                                </h4>
                                <button onClick={handleAutoGenerateSEO}
                                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                  Auto SEO
                                </button>
                              </div>
                              <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Title *</label>
                                    <input type="text" value={editForm.title} onChange={handleTitleChange}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500" required />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Content Type</label>
                                    <select value={editForm.contentType} onChange={e => setEditForm({ ...editForm, contentType: e.target.value as 'Anime' | 'Movie' | 'Manga' })}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500">
                                      <option value="Anime">Anime</option>
                                      <option value="Movie">Movie</option>
                                      <option value="Manga">Manga</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Release Year</label>
                                    <input type="number" value={editForm.releaseYear} onChange={e => setEditForm({ ...editForm, releaseYear: Number(e.target.value) })}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500" min="1900" max="2030" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Sub/Dub</label>
                                    <select value={editForm.subDubStatus} onChange={handleSubDubStatusChange}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500">
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
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500">
                                      <option value="Ongoing">Ongoing</option>
                                      <option value="Complete">Complete</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Thumbnail URL</label>
                                    <input type="url" value={editForm.thumbnail} onChange={e => setEditForm({ ...editForm, thumbnail: e.target.value })}
                                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                                      placeholder="https://..." />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                                  <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 h-16" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-300 mb-1">Genres (comma separated)</label>
                                  <input type="text" value={editForm.genreList.join(', ')} onChange={handleGenreChange}
                                    className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                                    placeholder="Action, Adventure, Fantasy" />
                                </div>

                                {/* SEO Section */}
                                <div className="pt-3 border-t border-white/10">
                                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                                    SEO Settings
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-300 mb-1">
                                        SEO Title <span className={`text-xs ml-1 ${editForm.seoTitle.length > 60 ? 'text-red-400' : 'text-green-400'}`}>({editForm.seoTitle.length}/60)</span>
                                      </label>
                                      <input type="text" value={editForm.seoTitle} onChange={e => setEditForm({ ...editForm, seoTitle: e.target.value })}
                                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500" maxLength={60} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-slate-300 mb-1">
                                        URL Slug <span className="text-xs text-blue-400 ml-1">/detail/{editForm.slug || 'slug'}</span>
                                      </label>
                                      <input type="text" value={editForm.slug} onChange={e => setEditForm({ ...editForm, slug: e.target.value })}
                                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                                        placeholder="anime-title-hindi-dub" />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="block text-xs font-medium text-slate-300 mb-1">
                                        SEO Description <span className={`text-xs ml-1 ${editForm.seoDescription.length > 160 ? 'text-red-400' : 'text-green-400'}`}>({editForm.seoDescription.length}/160)</span>
                                      </label>
                                      <textarea value={editForm.seoDescription} onChange={e => setEditForm({ ...editForm, seoDescription: e.target.value })}
                                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 h-16" maxLength={160} />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="block text-xs font-medium text-slate-300 mb-1">SEO Keywords</label>
                                      <textarea value={editForm.seoKeywords} onChange={e => setEditForm({ ...editForm, seoKeywords: e.target.value })}
                                        className="w-full bg-gray-800/60 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 h-16"
                                        placeholder="naruto hindi dub, watch naruto online..." />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <button type="submit"
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                                    Save Changes
                                  </button>
                                  <button type="button" onClick={handleCancelEdit}
                                    className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg text-sm">
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

      {filteredAnimes.length > 0 && (
        <div className="text-xs text-white/40 text-right">
          Showing {filteredAnimes.length} of {animes.length} anime
        </div>
      )}
    </div>
  );
};

export default AnimeListTable;