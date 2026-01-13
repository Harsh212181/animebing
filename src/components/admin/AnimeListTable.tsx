 // src/components/admin/AnimeListTable.tsx - UPDATED (Genre & Slug hidden from table)
import React, { useState, useEffect } from 'react';
import type { Anime } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

const AnimeListTable: React.FC = () => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [filteredAnimes, setFilteredAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ongoing' | 'Complete'>('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<'All' | 'Anime' | 'Movie' | 'Manga'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAnimeId, setEditingAnimeId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as Anime['subDubStatus'],
    genreList: [''],
    status: 'Ongoing',
    contentType: 'Anime' as 'Anime' | 'Movie' | 'Manga',
    
    // ✅ SEO FIELDS
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    slug: ''
  });

  useEffect(() => {
    fetchAnimes();
  }, [statusFilter, contentTypeFilter]);

  useEffect(() => {
    // Search functionality - INCLUDES SEO FIELDS
    if (searchQuery.trim() === '') {
      setFilteredAnimes(animes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = animes.filter(anime =>
        anime.title.toLowerCase().includes(query) ||
        anime.genreList.some(genre => 
          genre.toLowerCase().includes(query)
        ) ||
        anime.subDubStatus.toLowerCase().includes(query) ||
        anime.contentType.toLowerCase().includes(query) ||
        (anime.seoTitle && anime.seoTitle.toLowerCase().includes(query)) ||
        (anime.seoKeywords && anime.seoKeywords.toLowerCase().includes(query)) ||
        (anime.slug && anime.slug.toLowerCase().includes(query))
      );
      setFilteredAnimes(filtered);
    }
  }, [searchQuery, animes]);

  const fetchAnimes = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (contentTypeFilter !== 'All') params.append('contentType', contentTypeFilter);
      
      const url = `${API_BASE}/admin/protected/anime-list${params.toString() ? `?${params.toString()}` : ''}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ✅ Transform data with SEO fields
      const animeData = data.map((a: any) => ({ 
        ...a, 
        id: a._id,
        seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '',
        seoKeywords: a.seoKeywords || '',
        slug: a.slug || '',
        episodes: a.episodes || []
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

  const handleDelete = async (id: string) => {
    const animeTitle = animes.find(a => a.id === id)?.title || 'this anime';
    if (!confirm(`Delete "${animeTitle}"? This will also delete all episodes/chapters.`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/protected/delete-anime`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id }
      });
      setEditingAnimeId(null); // Close edit form if open
      fetchAnimes();
      alert('✅ Anime deleted successfully!');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.response?.data?.error || 'Delete failed. Please try again.');
    }
  };

  const handleEdit = (anime: Anime) => {
    if (editingAnimeId === anime.id) {
      setEditingAnimeId(null); // Toggle off
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
        // ✅ SEO FIELDS
        seoTitle: anime.seoTitle || '',
        seoDescription: anime.seoDescription || '',
        seoKeywords: anime.seoKeywords || '',
        slug: anime.slug || ''
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimeId) return;

    try {
      await axios.put(`${API_BASE}/admin/protected/edit-anime/${editingAnimeId}`, 
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('✅ Anime updated successfully! SEO data has been saved.');
      setEditingAnimeId(null);
      fetchAnimes();
    } catch (err: any) {
      console.error('Update error:', err);
      alert(err.response?.data?.error || 'Update failed. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingAnimeId(null);
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
    setEditForm({ ...editForm, genreList: genres.length ? genres : ['Action'] });
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // ✅ Auto-generate SEO data when title changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditForm({ ...editForm, title: newTitle });
    
    // Auto-generate slug if empty
    if (!editForm.slug && newTitle.trim()) {
      const generatedSlug = generateSlug(newTitle);
      setEditForm(prev => ({ 
        ...prev, 
        slug: generatedSlug,
        seoTitle: prev.seoTitle || `Watch ${newTitle} Online in ${prev.subDubStatus} | AnimeBing`
      }));
    }
  };

  // ✅ Function to generate SEO-friendly slug
  const generateSlug = (title: string): string => {
    if (!title.trim()) return '';
    
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Remove multiple hyphens
      .trim();
  };

  // ✅ Auto-generate SEO title when language changes
  const handleSubDubStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Anime['subDubStatus'];
    setEditForm({ ...editForm, subDubStatus: newStatus });
    
    if (editForm.title.trim()) {
      setEditForm(prev => ({ 
        ...prev, 
        seoTitle: `Watch ${prev.title} Online in ${newStatus} | AnimeBing`
      }));
    }
  };

  // ✅ Generate full SEO data
  const generateFullSEO = (): string => {
    if (!editForm.title.trim()) {
      return 'Please enter a title first';
    }

    // Generate keywords
    const keywords = [];
    
    // Title-based keywords
    keywords.push(
      `${editForm.title} anime`,
      `watch ${editForm.title} online`,
      `${editForm.title} ${editForm.subDubStatus.toLowerCase()}`,
      `${editForm.title} free download`
    );
    
    // Genre-based keywords
    if (editForm.genreList && editForm.genreList.length > 0) {
      editForm.genreList.forEach((genre: string) => {
        keywords.push(
          `${genre.toLowerCase()} anime`,
          `${editForm.title} ${genre.toLowerCase()}`,
          `${genre.toLowerCase()} anime in hindi`
        );
      });
    }
    
    // Language/Type based keywords
    const statuses = editForm.subDubStatus.toLowerCase().split(',').map(s => s.trim());
    
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
    
    // Content type keywords
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
    
    // Platform keywords
    keywords.push(
      'animebing',
      'animebing.in',
      'anime streaming site',
      'free anime downloads'
    );
    
    // Remove duplicates and join
    return [...new Set(keywords)].join(', ');
  };

  // ✅ Auto-generate SEO fields button
  const handleAutoGenerateSEO = () => {
    if (!editForm.title.trim()) {
      alert('Please enter a title first');
      return;
    }

    const generatedSlug = generateSlug(editForm.title);
    const seoKeywords = generateFullSEO();
    
    setEditForm(prev => ({
      ...prev,
      seoTitle: prev.seoTitle || `Watch ${prev.title} Online in ${prev.subDubStatus} | AnimeBing`,
      seoDescription: prev.seoDescription || 
        `Watch ${prev.title} online in ${prev.subDubStatus}. HD quality streaming and downloads. ${
          prev.contentType === 'Movie' ? 'Full movie available' : 'All episodes available'
        } on AnimeBing.`,
      seoKeywords: prev.seoKeywords || seoKeywords,
      slug: prev.slug || generatedSlug
    }));
    
    alert('✅ SEO data auto-generated successfully!');
  };

  // ✅ Function to get SEO status badge
  const getSEOStatus = (anime: Anime): { text: string, color: string, bgColor: string } => {
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

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by title, genre, language, SEO keywords, slug, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Results Count */}
            <div className="text-sm text-slate-300 whitespace-nowrap">
              {searchQuery ? (
                <span>
                  Showing {filteredAnimes.length} of {animes.length} results
                </span>
              ) : (
                <span>Total: {animes.length} items</span>
              )}
            </div>
          </div>
          
          {/* Search Tips */}
          {searchQuery && filteredAnimes.length === 0 && (
            <div className="mt-2 text-sm text-slate-400">
              💡 Try searching by: title, genre (action, romance), language (hindi, english), SEO keywords, slug, or type (anime, movie)
            </div>
          )}
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl font-semibold text-white">
            Content List
            <span className="text-sm text-slate-400 ml-2">
              {contentTypeFilter !== 'All' && `- ${contentTypeFilter}s`}
              {statusFilter !== 'All' && ` - ${statusFilter}`}
              {searchQuery && ` - "${searchQuery}"`}
            </span>
          </h3>
          
          <div className="flex items-center gap-4">
            {/* Content Type Filter */}
            <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg">
              <button
                onClick={() => setContentTypeFilter('All')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  contentTypeFilter === 'All'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Show all content types"
              >
                All
              </button>
              <button
                onClick={() => setContentTypeFilter('Anime')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  contentTypeFilter === 'Anime'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Filter by Anime"
              >
                Anime
              </button>
              <button
                onClick={() => setContentTypeFilter('Movie')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  contentTypeFilter === 'Movie'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Filter by Movies"
              >
                Movies
              </button>
              <button
                onClick={() => setContentTypeFilter('Manga')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  contentTypeFilter === 'Manga'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Filter by Manga"
              >
                Manga
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'All'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Show all status"
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('Ongoing')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'Ongoing'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Filter by Ongoing"
              >
                Ongoing
              </button>
              <button
                onClick={() => setStatusFilter('Complete')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'Complete'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="Filter by Complete"
              >
                Complete
              </button>
            </div>
            
            <button 
              onClick={fetchAnimes}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
              aria-label="Refresh anime list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="p-4 text-left text-slate-300 font-medium">Title</th>
                <th className="p-4 text-left text-slate-300 font-medium">Type</th>
                <th className="p-4 text-left text-slate-300 font-medium">Year</th>
                <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                <th className="p-4 text-left text-slate-300 font-medium">Sub/Dub</th>
                <th className="p-4 text-left text-slate-300 font-medium">Episodes</th>
                <th className="p-4 text-left text-slate-300 font-medium">SEO Status</th>
                <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredAnimes.map(anime => {
                const seoStatus = getSEOStatus(anime);
                
                return (
                  <React.Fragment key={anime.id}>
                    <tr className={`hover:bg-slate-700/30 transition-colors ${editingAnimeId === anime.id ? 'bg-slate-700/50' : ''}`}>
                      <td className="p-4 font-medium text-white">
                        {/* ✅ TITLE COLUMN - Only show Title and Thumbnail */}
                        <div className="flex items-center gap-3">
                          <img 
                            src={anime.thumbnail} 
                            alt={anime.title}
                            className="w-12 h-16 object-cover rounded"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/48x64/1e293b/64748b?text=No+Image';
                            }}
                          />
                          <div>
                            {/* ✅ Only Title (No genre or slug text) */}
                            <div className="font-semibold">{anime.title}</div>
                            {/* ✅ Genre and slug text REMOVED from display */}
                          </div>
                        </div>
                      </td>
                      
                      {/* ✅ TYPE COLUMN */}
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          anime.contentType === 'Movie' 
                            ? 'bg-blue-600 text-white' 
                            : anime.contentType === 'Manga'
                            ? 'bg-green-600 text-white'
                            : 'bg-purple-600 text-white'
                        }`}>
                          {anime.contentType}
                        </span>
                      </td>
                      
                      {/* ✅ YEAR COLUMN */}
                      <td className="p-4 text-slate-300 text-center">
                        {anime.releaseYear || 'N/A'}
                      </td>
                      
                      {/* ✅ STATUS COLUMN */}
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          anime.status === 'Complete' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-yellow-600 text-white'
                        }`}>
                          {anime.status || 'Ongoing'}
                        </span>
                      </td>
                      
                      {/* ✅ SUB/DUB COLUMN */}
                      <td className="p-4">
                        <span 
                          className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            anime.subDubStatus === 'Hindi Dub' 
                              ? 'bg-red-600 text-white' 
                              : anime.subDubStatus === 'Hindi Sub'
                              ? 'bg-orange-600 text-white'
                              : anime.subDubStatus === 'English Sub'
                              ? 'bg-blue-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                          style={{ minWidth: '80px', display: 'inline-block', textAlign: 'center' }}
                        >
                          {anime.subDubStatus}
                        </span>
                      </td>
                      
                      {/* ✅ EPISODES COLUMN */}
                      <td className="p-4 text-slate-300 text-center">
                        <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs whitespace-nowrap">
                          {anime.episodes?.length || 0} episodes
                        </span>
                      </td>
                      
                      {/* ✅ SEO STATUS COLUMN */}
                      <td className="p-4">
                        <span className={`${seoStatus.bgColor} ${seoStatus.color} px-2 py-1 rounded text-xs whitespace-nowrap`}>
                          {seoStatus.text}
                        </span>
                      </td>
                      
                      {/* ✅ ACTIONS COLUMN */}
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(anime)}
                            className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                              editingAnimeId === anime.id 
                                ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                            aria-label={`Edit ${anime.title}`}
                          >
                            {editingAnimeId === anime.id ? 'Cancel Edit' : 'Edit SEO'}
                          </button>
                          {editingAnimeId !== anime.id && (
                            <button
                              onClick={() => handleDelete(anime.id)}
                              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors whitespace-nowrap"
                              aria-label={`Delete ${anime.title}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* ✅ EDIT FORM ROW - Appears only when Edit button clicked */}
                    {editingAnimeId === anime.id && (
                      <tr className="bg-slate-800/70">
                        <td colSpan={8} className="p-4">
                          <div className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit {anime.contentType}: {anime.title}
                              </h4>
                              <button
                                onClick={handleAutoGenerateSEO}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex items-center gap-1"
                                aria-label="Auto-generate SEO data"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Auto-Generate SEO
                              </button>
                            </div>
                            
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                                  <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={handleTitleChange}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    required
                                    aria-required="true"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Content Type</label>
                                  <select
                                    value={editForm.contentType}
                                    onChange={(e) => setEditForm({ ...editForm, contentType: e.target.value as 'Anime' | 'Movie' | 'Manga' })}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                  >
                                    <option value="Anime">Anime Series</option>
                                    <option value="Movie">Movie</option>
                                    <option value="Manga">Manga</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Release Year</label>
                                  <input
                                    type="number"
                                    value={editForm.releaseYear}
                                    onChange={(e) => setEditForm({ ...editForm, releaseYear: Number(e.target.value) })}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    min="1900"
                                    max="2030"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Sub/Dub Status</label>
                                  <select
                                    value={editForm.subDubStatus}
                                    onChange={handleSubDubStatusChange}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                                  <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                  >
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="Complete">Complete</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-1">Thumbnail URL</label>
                                  <input
                                    type="url"
                                    value={editForm.thumbnail}
                                    onChange={(e) => setEditForm({ ...editForm, thumbnail: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="https://res.cloudinary.com/..."
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                                <textarea
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors h-20"
                                  placeholder="Brief description of the anime..."
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Genres (comma separated)</label>
                                <input
                                  type="text"
                                  value={editForm.genreList.join(', ')}
                                  onChange={handleGenreChange}
                                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                  placeholder="Action, Adventure, Fantasy"
                                />
                              </div>

                              {/* ✅ SEO SECTION - This is where genre and slug will be edited */}
                              <div className="mt-6 pt-4 border-t border-slate-600">
                                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                  </svg>
                                  SEO Settings (For Google Search)
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      SEO Title
                                      <span className={`text-xs ml-2 ${editForm.seoTitle.length > 60 ? 'text-red-400' : 'text-green-400'}`}>
                                        ({editForm.seoTitle.length}/60)
                                      </span>
                                    </label>
                                    <input
                                      type="text"
                                      value={editForm.seoTitle}
                                      onChange={(e) => setEditForm({ ...editForm, seoTitle: e.target.value })}
                                      className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors"
                                      placeholder="Watch {Title} Online in {Language} | AnimeBing"
                                      maxLength={60}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Appears in Google search results</p>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      URL Slug
                                      <span className="text-xs text-blue-400 ml-2">animebing.in/detail/{editForm.slug || 'your-slug'}</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={editForm.slug}
                                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                                      className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                      placeholder="naruto-shippuden-hindi-dub"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">SEO-friendly URL (lowercase, hyphens)</p>
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      SEO Description
                                      <span className={`text-xs ml-2 ${editForm.seoDescription.length > 160 ? 'text-red-400' : 'text-green-400'}`}>
                                        ({editForm.seoDescription.length}/160)
                                      </span>
                                    </label>
                                    <textarea
                                      value={editForm.seoDescription}
                                      onChange={(e) => setEditForm({ ...editForm, seoDescription: e.target.value })}
                                      className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors h-20"
                                      placeholder="Watch {Title} online in {Language}. HD quality streaming and downloads. All episodes available."
                                      maxLength={160}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Appears below the title in Google search results</p>
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      SEO Keywords (Comma separated)
                                      <span className="text-xs text-slate-400 ml-2">Important for search rankings</span>
                                    </label>
                                    <textarea
                                      value={editForm.seoKeywords}
                                      onChange={(e) => setEditForm({ ...editForm, seoKeywords: e.target.value })}
                                      className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-colors h-20"
                                      placeholder="naruto shippuden hindi dub, watch naruto shippuden online, naruto anime in hindi, action anime, adventure anime"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Keywords that users might search for on Google</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3 pt-2">
                                <button
                                  type="submit"
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-2 px-4 rounded text-sm transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save Changes & SEO
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
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
              })}
            </tbody>
          </table>
        </div>
        
        {filteredAnimes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">
              {searchQuery ? '🔍' : '📺'}
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {searchQuery ? 'No Results Found' : 'No Content Found'}
            </h3>
            <p className="text-slate-400">
              {searchQuery 
                ? `No results found for "${searchQuery}". Try different keywords.`
                : statusFilter !== 'All' || contentTypeFilter !== 'All'
                ? `No ${contentTypeFilter !== 'All' ? contentTypeFilter : ''} ${statusFilter !== 'All' ? statusFilter : ''} content found.` 
                : 'Get started by adding your first anime or movie!'
              }
            </p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-4 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimeListTable;