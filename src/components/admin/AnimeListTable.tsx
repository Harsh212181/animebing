// src/components/admin/AnimeListTable.tsx - COMPLETE WITH EDIT FUNCTIONALITY
import React, { useState, useEffect } from 'react';
import type { Anime } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

const AnimeListTable: React.FC = () => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ongoing' | 'Complete'>('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<'All' | 'Anime' | 'Movie'>('All');
  const [editingAnime, setEditingAnime] = useState<Anime | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as Anime['subDubStatus'],
    genreList: [''],
    status: 'Ongoing',
    contentType: 'Anime' as 'Anime' | 'Movie'
  });

  useEffect(() => {
    fetchAnimes();
  }, [statusFilter, contentTypeFilter]);

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
      setAnimes(data.map((a: any) => ({ ...a, id: a._id })));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load anime');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const animeTitle = animes.find(a => a.id === id)?.title || 'this anime';
    if (!confirm(`Delete "${animeTitle}"? This will also delete all episodes.`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/protected/delete-anime`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id }
      });
      fetchAnimes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleEdit = (anime: Anime) => {
    setEditingAnime(anime);
    setEditForm({
      title: anime.title,
      description: anime.description || '',
      thumbnail: anime.thumbnail,
      releaseYear: anime.releaseYear,
      subDubStatus: anime.subDubStatus,
      genreList: anime.genreList,
      status: anime.status || 'Ongoing',
      contentType: anime.contentType || 'Anime'
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnime) return;

    try {
      await axios.put(`${API_BASE}/admin/protected/edit-anime/${editingAnime.id}`, 
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Anime updated successfully!');
      setEditingAnime(null);
      fetchAnimes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
    setEditForm({ ...editForm, genreList: genres.length ? genres : ['Action'] });
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold text-white">
          Content List ({animes.length})
          <span className="text-sm text-slate-400 ml-2">
            {contentTypeFilter !== 'All' && `- ${contentTypeFilter}s`}
            {statusFilter !== 'All' && ` - ${statusFilter}`}
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
            >
              Movies
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
            >
              Complete
            </button>
          </div>
          
          <button 
            onClick={fetchAnimes}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingAnime && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Edit {editingAnime.contentType}</h3>
              <button
                onClick={() => setEditingAnime(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
                  <select
                    value={editForm.contentType}
                    onChange={(e) => setEditForm({ ...editForm, contentType: e.target.value as 'Anime' | 'Movie' })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  >
                    <option value="Anime">Anime Series</option>
                    <option value="Movie">Movie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Release Year</label>
                  <input
                    type="number"
                    value={editForm.releaseYear}
                    onChange={(e) => setEditForm({ ...editForm, releaseYear: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    min="1900"
                    max="2030"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Sub/Dub Status</label>
                  <select
                    value={editForm.subDubStatus}
                    onChange={(e) => setEditForm({ ...editForm, subDubStatus: e.target.value as Anime['subDubStatus'] })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  >
                    <option value="Hindi Dub">Hindi Dub</option>
                    <option value="Hindi Sub">Hindi Sub</option>
                    <option value="Both">Both</option>
                    <option value="Subbed">Subbed</option>
                    <option value="Dubbed">Dubbed</option>
                    <option value="Sub & Dub">Sub & Dub</option>
                    <option value="Dual Audio">Dual Audio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Thumbnail URL</label>
                  <input
                    type="url"
                    value={editForm.thumbnail}
                    onChange={(e) => setEditForm({ ...editForm, thumbnail: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Genres (comma separated)</label>
                <input
                  type="text"
                  value={editForm.genreList.join(', ')}
                  onChange={handleGenreChange}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Action, Adventure, Fantasy"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAnime(null)}
                  className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <th className="p-4 text-left text-slate-300 font-medium">Reports</th>
                <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {animes.map(anime => (
                <tr key={anime.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 font-medium text-white">
                    <div className="flex items-center gap-3">
                      <img 
                        src={anime.thumbnail} 
                        alt={anime.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                      <div>
                        <div>{anime.title}</div>
                        <div className="text-xs text-slate-400">
                          {anime.genreList.slice(0, 2).join(', ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      anime.contentType === 'Movie' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-purple-600 text-white'
                    }`}>
                      {anime.contentType}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">{anime.releaseYear}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      anime.status === 'Complete' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-yellow-600 text-white'
                    }`}>
                      {anime.status || 'Ongoing'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 text-sm">{anime.subDubStatus}</td>
                  <td className="p-4 text-slate-300">
                    <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs">
                      {anime.episodes?.length || 0} episodes
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">
                    {anime.reportCount ? (
                      <span className="bg-red-600/20 text-red-400 px-2 py-1 rounded text-xs">
                        {anime.reportCount} reports
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">No reports</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(anime)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(anime.id)}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {animes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📺</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Content Found</h3>
            <p className="text-slate-400">
              {statusFilter !== 'All' || contentTypeFilter !== 'All'
                ? `No ${contentTypeFilter !== 'All' ? contentTypeFilter : ''} ${statusFilter !== 'All' ? statusFilter : ''} content found.` 
                : 'Get started by adding your first anime or movie!'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimeListTable;