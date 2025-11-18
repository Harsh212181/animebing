 // src/components/admin/AddAnimeForm.tsx - UPDATED VERSION
import React, { useState } from 'react';
import axios from 'axios';
import type { SubDubStatus } from '../../types';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

const AddAnimeForm: React.FC = () => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    thumbnail: '',
    releaseYear: new Date().getFullYear(),
    subDubStatus: 'Hindi Sub' as SubDubStatus,
    genreList: [],
    status: 'Ongoing',
    contentType: 'Anime' as 'Anime' | 'Movie' | 'Manga'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await axios.post(`${API_BASE}/admin/protected/add-anime`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Anime added successfully! Check the list tab.');
      // Reset form
      setForm({
        title: '',
        description: '',
        thumbnail: '',
        releaseYear: new Date().getFullYear(),
        subDubStatus: 'Hindi Sub',
        genreList: [],
        status: 'Ongoing',
        contentType: 'Anime'
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add anime');
    } finally {
      setLoading(false);
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
    setForm({ ...form, genreList: genres });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Add New Anime</h2>
      <form onSubmit={handleSubmit} className="space-y-4 bg-slate-700/50 p-6 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder="e.g., Naruto Shippuden"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition h-24"
            placeholder="Brief description..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Thumbnail URL</label>
          <input
            type="url"
            value={form.thumbnail}
            onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder="https://example.com/thumbnail.jpg"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Release Year</label>
            <input
              type="number"
              value={form.releaseYear}
              onChange={(e) => setForm({ ...form, releaseYear: Number(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
              min="1900"
              max="2030"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
            <select
              value={form.contentType}
              onChange={(e) => setForm({ ...form, contentType: e.target.value as 'Anime' | 'Movie' | 'Manga' })}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
            >
              <option value="Anime">Anime Series</option>
              <option value="Movie">Movie</option>
              <option value="Manga">Manga</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sub/Dub Status</label>
            <select
              value={form.subDubStatus}
              onChange={(e) => setForm({ ...form, subDubStatus: e.target.value as SubDubStatus })}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
            >
              <option value="Hindi Dub">Hindi Dub</option>
              <option value="Hindi Sub">Hindi Sub</option>
              <option value="Both">Both</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Genres (comma-separated) *
          </label>
          <input
            type="text"
            value={form.genreList.join(', ')}
            onChange={handleGenreChange}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder="Action, Adventure, Fantasy"
            required
          />
          <p className="text-slate-400 text-xs mt-1">
            Separate multiple genres with commas
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          >
            <option value="Ongoing">Ongoing</option>
            <option value="Complete">Complete</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !form.title.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition"
        >
          {loading ? <Spinner className="inline h-5 w-5 mx-auto" /> : 'Add Anime'}
        </button>
        {success && <p className="text-green-400 text-sm text-center mt-2">{success}</p>}
        {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
      </form>
    </div>
  );
};

export default AddAnimeForm;