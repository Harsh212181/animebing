 import React, { useState, useEffect } from 'react';
import { DownloadPage, DownloadPageLink, ContentType, SubDubStatus } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import Spinner from '../Spinner';

const getApiBase = () => {
  if (typeof window === 'undefined') return 'https://animabing.onrender.com/api';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'http://localhost:3000/api' : 'https://animabing.onrender.com/api';
};
const API_BASE = getApiBase();

const getFrontendBase = () => {
  if (typeof window === 'undefined') return 'https://animebing.in';
  return window.location.origin;
};

const getToken = () => localStorage.getItem('adminToken') || '';

interface AnimeOption {
  _id: string;
  title: string;
}

interface FormPage {
  _id?: string;
  animeId: string;
  slug: string;
  title: string;
  episodeNumber: number;
  links: DownloadPageLink[];
}

// Helper to safely get anime title from a DownloadPage (for search)
const getAnimeTitle = (page: DownloadPage): string => {
  if (page.animeId && typeof page.animeId === 'object' && 'title' in page.animeId) {
    return page.animeId.title;
  }
  return 'Unknown Anime';
};

// Helper to get full anime details (title, contentType, subDubStatus) – now with proper types
const getAnimeDetails = (page: DownloadPage): { title: string; contentType?: ContentType; subDubStatus?: SubDubStatus } => {
  if (page.animeId && typeof page.animeId === 'object') {
    return {
      title: page.animeId.title || 'Unknown Anime',
      contentType: page.animeId.contentType,
      subDubStatus: page.animeId.subDubStatus
    };
  }
  return { title: 'Unknown Anime' };
};

const DownloadPageManager: React.FC = () => {
  const [pages, setPages] = useState<DownloadPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<FormPage | null>(null);
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/download-pages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPages(data);
      } else if (data.data && Array.isArray(data.data)) {
        setPages(data.data);
      } else {
        console.error('Unexpected response format:', data);
        setPages([]);
      }
    } catch (error) {
      console.error('Failed to fetch pages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch pages');
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnime = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/anime?limit=500`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const animeArray = json.data || json;
      if (Array.isArray(animeArray)) {
        setAnimeOptions(animeArray.map((a: any) => ({ _id: a._id, title: a.title })));
      } else {
        console.error('Expected array but got:', json);
        setAnimeOptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch anime:', error);
      setAnimeOptions([]);
    }
  };

  useEffect(() => {
    fetchPages();
    fetchAnime();
  }, []);

  const convertToFormPage = (page: DownloadPage): FormPage => ({
    _id: page._id,
    animeId: typeof page.animeId === 'string' ? page.animeId : page.animeId._id,
    slug: page.slug,
    title: page.title,
    episodeNumber: page.episodeNumber || 1,
    links: page.links.map(link => ({
      ...link,
      type: (link as any).type || 'download'
    }))
  });

  const handleSave = async () => {
    if (!editingPage?.animeId) {
      alert('Please select an anime');
      return;
    }
    if (!editingPage.slug) {
      alert('Please enter a slug (e.g., naruto-eps-1-10)');
      return;
    }
    if (!editingPage.episodeNumber || editingPage.episodeNumber < 1) {
      alert('Please enter a valid episode number (minimum 1)');
      return;
    }
    if (!editingPage.links || editingPage.links.length === 0) {
      alert('Please add at least one link');
      return;
    }

    // Frontend per‑type validation
    const watchCount = editingPage.links.filter(l => l.type === 'watch').length;
    const downloadCount = editingPage.links.filter(l => l.type === 'download').length;
    if (watchCount > 12) {
      alert(`You cannot have more than 12 watch links. Currently: ${watchCount}`);
      return;
    }
    if (downloadCount > 12) {
      alert(`You cannot have more than 12 download links. Currently: ${downloadCount}`);
      return;
    }

    const method = editingPage._id ? 'PUT' : 'POST';
    const url = editingPage._id
      ? `${API_BASE}/download-pages/${editingPage._id}`
      : `${API_BASE}/download-pages`;

    try {
      const token = getToken();
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(editingPage),
      });
      if (res.ok) {
        fetchPages();
        setEditingPage(null);
        setShowForm(false);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(err.error || 'Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Network error. Check console.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/download-pages/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) fetchPages();
      else alert('Delete failed');
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const addDownloadLink = () => {
    setEditingPage((prev: FormPage | null): FormPage | null => {
      if (!prev) return null;
      const downloadCount = prev.links.filter(l => l.type === 'download').length;
      const nextEpisode = downloadCount + 1;
      const newLink: DownloadPageLink = {
        episode: nextEpisode,
        url: '',
        type: 'download',
        quality: '',
        language: ''
      };
      return {
        ...prev,
        links: [...prev.links, newLink]
      };
    });
  };

  const addWatchLink = () => {
    setEditingPage((prev: FormPage | null): FormPage | null => {
      if (!prev) return null;
      const watchCount = prev.links.filter(l => l.type === 'watch').length;
      const nextEpisode = watchCount + 1;
      const newLink: DownloadPageLink = {
        episode: nextEpisode,
        url: '',
        type: 'watch',
        quality: '',
        language: ''
      };
      return {
        ...prev,
        links: [...prev.links, newLink]
      };
    });
  };

  const updateLink = (index: number, field: keyof DownloadPageLink, value: any) => {
    setEditingPage((prev: FormPage | null): FormPage | null => {
      if (!prev) return null;
      const newLinks = [...prev.links];
      newLinks[index] = { ...newLinks[index], [field]: value };
      return { ...prev, links: newLinks };
    });
  };

  const removeLink = (index: number) => {
    setEditingPage((prev: FormPage | null): FormPage | null => {
      if (!prev) return null;
      const newLinks = prev.links.filter((_, i) => i !== index);
      return { ...prev, links: newLinks };
    });
  };

  // Filter pages based on anime title only
  const filteredPages = pages.filter(page => {
    const animeTitle = getAnimeTitle(page).toLowerCase();
    const term = searchTerm.toLowerCase();
    return animeTitle.includes(term);
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Spinner size="lg" text="Loading download pages..." />
    </div>
  );

  // Compute current counts for the form (if editing)
  const watchCount = editingPage ? editingPage.links.filter(l => l.type === 'watch').length : 0;
  const downloadCount = editingPage ? editingPage.links.filter(l => l.type === 'download').length : 0;

  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          Download Pages Manager
        </h1>
      </div>

      {/* Alerts */}
      {error && (
        <div className="relative p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl backdrop-blur-sm text-rose-200 flex items-center gap-3 shadow-lg shadow-rose-500/5">
          <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* New Page Button */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
            Create New Download Page
          </h2>
          <button
            onClick={() => {
              setEditingPage({ animeId: '', slug: '', title: '', episodeNumber: 1, links: [] });
              setShowForm(true);
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            + New Page
          </button>
        </div>
      </div>

      {/* Inline Form */}
      {showForm && editingPage && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">
              {editingPage._id ? 'Edit' : 'Create'} Download Page
            </h3>
          </div>

          <div className="space-y-6">
            {/* Anime Selector */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-emerald-400 rounded-full"></span>
                Anime *
              </label>
              <SearchableDropdown
                options={animeOptions}
                value={animeOptions.find(a => a._id === editingPage.animeId) || null}
                onChange={option => setEditingPage({ ...editingPage, animeId: option?._id || '' })}
                placeholder="Search anime..."
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-indigo-400 rounded-full"></span>
                Slug (unique) *
              </label>
              <input
                type="text"
                value={editingPage.slug || ''}
                onChange={e => setEditingPage({ ...editingPage, slug: e.target.value })}
                className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="e.g., naruto-eps-1-10"
              />
            </div>

            {/* Episode Number */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
                Episode Number (where this button should appear) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={editingPage.episodeNumber || ''}
                onChange={e => setEditingPage({ ...editingPage, episodeNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="e.g., 1"
              />
              <p className="text-xs text-white/40 mt-1">
                The episode number where this download page button should be shown.
              </p>
            </div>

            {/* Button Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-pink-400 rounded-full"></span>
                Button Title
              </label>
              <input
                type="text"
                value={editingPage.title || ''}
                onChange={e => setEditingPage({ ...editingPage, title: e.target.value })}
                className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Download"
              />
            </div>

            {/* Links */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
                Links (Max 12 watch, 12 download)
              </label>
              {editingPage.links?.map((link, idx) => (
                <div key={idx} className="bg-gray-800/40 border border-white/5 rounded-xl p-4 mb-3">
                  <div className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-1">
                      <input
                        type="number"
                        placeholder="Ep"
                        value={link.episode}
                        onChange={e => updateLink(idx, 'episode', parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-700/60 border border-gray-600/80 rounded-lg px-2 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={link.type}
                        onChange={e => updateLink(idx, 'type', e.target.value as 'download' | 'watch')}
                        className="w-full bg-gray-700/60 border border-gray-600/80 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="download">Download</option>
                        <option value="watch">Watch</option>
                      </select>
                    </div>
                    <div className="col-span-7">
                      <input
                        type="url"
                        placeholder="URL"
                        value={link.url}
                        onChange={e => updateLink(idx, 'url', e.target.value)}
                        className="w-full bg-gray-700/60 border border-gray-600/80 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => removeLink(idx)}
                        className="bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 text-rose-200 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Quality (e.g., 1080p)"
                      value={link.quality || ''}
                      onChange={e => updateLink(idx, 'quality', e.target.value)}
                      className="bg-gray-700/60 border border-gray-600/80 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="Language (e.g., English)"
                      value={link.language || ''}
                      onChange={e => updateLink(idx, 'language', e.target.value)}
                      className="bg-gray-700/60 border border-gray-600/80 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={addDownloadLink}
                  disabled={downloadCount >= 12}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-xl text-blue-200 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  + Add Download Link ({downloadCount}/12)
                </button>
                <button
                  onClick={addWatchLink}
                  disabled={watchCount >= 12}
                  className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-xl text-green-200 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  + Add Watch Link ({watchCount}/12)
                </button>
              </div>
              {(downloadCount >= 12 || watchCount >= 12) && (
                <p className="text-xs text-yellow-500 mt-2">
                  {downloadCount >= 12 && 'Download limit reached. '}
                  {watchCount >= 12 && 'Watch limit reached.'}
                </p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => { setShowForm(false); setEditingPage(null); }}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List of Pages with Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
            All Download Pages
            {pages.length > 0 && (
              <span className="ml-2 text-sm font-normal px-3 py-1 bg-white/5 rounded-full text-white/60">
                {filteredPages.length} / {pages.length}
              </span>
            )}
          </h2>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by anime title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition pl-10"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500"
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

        {filteredPages.length === 0 && !error ? (
          <div className="text-center py-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            <svg className="w-16 h-16 mx-auto text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <p className="mt-4 text-white/60 text-lg">
              {searchTerm ? 'No download pages found for this anime.' : 'No download pages found.'}
            </p>
            <p className="text-white/40">
              {searchTerm ? 'Try a different anime title.' : 'Create your first page above.'}
            </p>
          </div>
        ) : (
          filteredPages.map(page => {
            const animeDetails = getAnimeDetails(page);
            return (
              <div
                key={page._id}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-xl transition-all hover:shadow-2xl hover:border-white/20"
              >
                <div className="relative p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Colored left accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-400 to-pink-400 rounded-l-2xl"></div>

                  <div className="flex-1 pl-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-xl font-bold text-white">
                        {animeDetails.title}
                      </h3>
                      {/* Content Type Badge */}
                      {animeDetails.contentType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          animeDetails.contentType === 'Movie'
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                            : animeDetails.contentType === 'Manga'
                            ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                            : 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                        }`}>
                          {animeDetails.contentType}
                        </span>
                      )}
                      {/* Sub/Dub Status Badge – now properly typed */}
                      {animeDetails.subDubStatus && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-pink-600/30 text-pink-300 border border-pink-500/50">
                          {animeDetails.subDubStatus}
                        </span>
                      )}
                      <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md ml-auto sm:ml-0">
                        ID: {page._id.slice(-6)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-white/70">
                        <span className="text-purple-300 font-medium">Slug:</span> {page.slug}
                      </span>
                      <span className="text-white/70">
                        <span className="text-purple-300 font-medium">Links:</span> {page.links.length}
                      </span>
                      <span className="text-white/70">
                        <span className="text-purple-300 font-medium">Episode:</span> {page.episodeNumber}
                      </span>
                      {page.title && (
                        <span className="text-white/70">
                          <span className="text-purple-300 font-medium">Button:</span> {page.title}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-sm text-white/50 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                      </svg>
                      {(() => {
                        const downloadCount = page.links.filter(l => l.type === 'download').length;
                        const watchCount = page.links.filter(l => l.type === 'watch').length;
                        return (
                          <>
                            <span>Download: <span className="text-emerald-300 font-medium">{downloadCount}</span></span>
                            <span>Watch: <span className="text-blue-300 font-medium">{watchCount}</span></span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action buttons – they should appear here */}
                  <div className="flex gap-2 items-center">
                    {/* View button – opens public page */}
                    <button
                      onClick={() => window.open(`${getFrontendBase()}/download/${page.slug}`, '_blank')}
                      title="View public page"
                      className="p-2.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl text-white/80 hover:text-emerald-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setEditingPage(convertToFormPage(page)); setShowForm(true); }}
                      title="Edit page"
                      className="p-2.5 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl text-white/80 hover:text-indigo-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(page._id)}
                      title="Delete page"
                      className="p-2.5 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-xl text-white/80 hover:text-rose-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DownloadPageManager;