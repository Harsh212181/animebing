 import React, { useState, useEffect } from 'react';
import { DownloadPage, DownloadLink } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import Spinner from '../Spinner';

const getApiBase = () => {
  if (typeof window === 'undefined') return 'https://animabing.onrender.com/api';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'http://localhost:3000/api' : 'https://animabing.onrender.com/api';
};
const API_BASE = getApiBase();

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
  links: DownloadLink[];
}

const DownloadPageManager: React.FC = () => {
  const [pages, setPages] = useState<DownloadPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<FormPage | null>(null);
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    animeId: page.animeId._id,
    slug: page.slug,
    title: page.title,
    links: page.links
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
    if (!editingPage.links || editingPage.links.length === 0) {
      alert('Please add at least one download link');
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

  const addLink = () => {
    setEditingPage((prev: FormPage | null): FormPage | null => {
      if (!prev) return null;
      const newLink = { episode: 1, url: '' } as DownloadLink;
      return {
        ...prev,
        links: [...prev.links, newLink]
      };
    });
  };

  const updateLink = (index: number, field: keyof DownloadLink, value: any) => {
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

  if (loading) return <Spinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-purple-600">Download Pages Manager</h2>
        <button
          onClick={() => {
            setEditingPage({ 
              animeId: '', 
              slug: '', 
              title: '', 
              links: [{ episode: 1, url: '' } as DownloadLink] 
            });
            setShowForm(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
        >
          + New Page
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {/* Inline Form */}
      {showForm && editingPage && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingPage._id ? 'Edit' : 'Create'} Download Page
          </h3>

          <div className="space-y-4">
            {/* Anime Selector */}
            <div>
              <label className="block text-sm mb-1">Anime *</label>
              <SearchableDropdown
                options={animeOptions}
                value={animeOptions.find(a => a._id === editingPage.animeId) || null}
                onChange={option => setEditingPage({ ...editingPage, animeId: option?._id || '' })}
                placeholder="Search anime..."
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm mb-1">Slug (unique) *</label>
              <input
                type="text"
                value={editingPage.slug || ''}
                onChange={e => setEditingPage({ ...editingPage, slug: e.target.value })}
                className="w-full bg-gray-700 rounded px-3 py-2"
                placeholder="e.g., naruto-eps-1-10 (not a URL)"
              />
            </div>

            {/* Button Title */}
            <div>
              <label className="block text-sm mb-1">Button Title</label>
              <input
                type="text"
                value={editingPage.title || ''}
                onChange={e => setEditingPage({ ...editingPage, title: e.target.value })}
                className="w-full bg-gray-700 rounded px-3 py-2"
                placeholder="Download"
              />
            </div>

            {/* Links */}
            <div>
              <label className="block text-sm mb-2">Links (1-10) *</label>
              {editingPage.links?.map((link, idx) => (
                <div key={idx} className="bg-gray-700 p-3 rounded mb-2">
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    <input
                      type="number"
                      placeholder="Ep"
                      value={link.episode}
                      onChange={e => updateLink(idx, 'episode', parseInt(e.target.value))}
                      className="col-span-1 bg-gray-600 rounded px-2 py-1"
                    />
                    <input
                      type="url"
                      placeholder="Download URL"
                      value={link.url}
                      onChange={e => updateLink(idx, 'url', e.target.value)}
                      className="col-span-5 bg-gray-600 rounded px-2 py-1"
                    />
                  </div>
                  <button
                    onClick={() => removeLink(idx)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {(!editingPage.links || editingPage.links.length < 10) && (
                <button
                  onClick={addLink}
                  className="mt-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm"
                >
                  + Add Link
                </button>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => { setShowForm(false); setEditingPage(null); }}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {pages.map(page => (
          <div key={page._id} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{page.animeId?.title || 'Unknown Anime'}</h3>
              <p className="text-sm text-gray-400">
                Slug: {page.slug} | Links: {page.links.length} | Button: {page.title}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingPage(convertToFormPage(page)); setShowForm(true); }}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(page._id)}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {pages.length === 0 && !error && (
          <p className="text-center text-gray-500 py-8">No download pages yet.</p>
        )}
      </div>
    </div>
  );
};

export default DownloadPageManager;