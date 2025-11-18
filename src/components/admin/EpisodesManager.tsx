 // src/components/admin/EpisodesManager.tsx - UPDATED WITH EDIT FUNCTIONALITY
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';
import SearchableDropdown from './SearchableDropdown';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

const EpisodesManager: React.FC = () => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newItem, setNewItem] = useState({
    number: 1,
    title: '',
    cutyLink: '',
    session: 1
  });
  const [loading, setLoading] = useState(true);
  const [animesLoading, setAnimesLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [editingItem, setEditingItem] = useState<Episode | Chapter | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isManga = selectedAnime?.contentType === 'Manga';

  // Get available sessions
  const getAvailableSessions = () => {
    const items = isManga ? chapters : episodes;
    const sessions = new Set<number>();
    items.forEach(item => sessions.add(item.session || 1));
    return Array.from(sessions).sort((a, b) => a - b);
  };

  // Filter items by session
  const filteredItems = (isManga ? chapters : episodes).filter(item => (item.session || 1) === selectedSession);

  useEffect(() => {
    fetchAnimes();
  }, []);

  const fetchAnimes = async () => {
    setAnimesLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnimes(data.map((a: any) => ({
        ...a,
        id: a._id || a.id
      })));
    } catch (err: any) {
      console.error('❌ Animes load error:', err.response?.data || err.message);
      alert('Failed to load animes');
    } finally {
      setAnimesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAnime) {
      fetchContent(selectedAnime.id);
    } else {
      setEpisodes([]);
      setChapters([]);
    }
  }, [selectedAnime]);

  const fetchContent = async (contentId: string) => {
    setLoading(true);
    try {
      if (isManga) {
        const { data } = await axios.get(`${API_BASE}/chapters/${contentId}`);
        setChapters(data);
        const lastChapter = data.filter((ch: Chapter) => (ch.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastChapter.length > 0 ? Math.max(...lastChapter.map((ch: Chapter) => ch.chapterNumber)) + 1 : 1,
          session: selectedSession
        }));
      } else {
        const { data } = await axios.get(`${API_BASE}/episodes/${contentId}`);
        setEpisodes(data);
        const lastEpisode = data.filter((ep: Episode) => (ep.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastEpisode.length > 0 ? Math.max(...lastEpisode.map((ep: Episode) => ep.episodeNumber)) + 1 : 1,
          session: selectedSession
        }));
      }
    } catch (err: any) {
      console.error('❌ Content load error:', err.response?.data || err.message);
      alert('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Handle Edit Item
  const handleEditItem = (item: Episode | Chapter) => {
    setEditingItem(item);
    setIsEditing(true);
    setNewItem({
      number: isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber,
      title: item.title || '',
      cutyLink: item.cutyLink,
      session: item.session || 1
    });
  };

  // ✅ NEW: Cancel Edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingItem(null);
    const nextNumber = getNextAvailableNumber();
    setNewItem({
      number: nextNumber,
      title: '',
      cutyLink: '',
      session: selectedSession
    });
  };

  // ✅ NEW: Get next available number
  const getNextAvailableNumber = () => {
    if (filteredItems.length === 0) return 1;
    const numbers = filteredItems.map(item => isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber);
    return Math.max(...numbers) + 1;
  };

  // ✅ UPDATED: Add/Edit Item Function
  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnime) {
      alert('Please select content first');
      return;
    }

    setAddingItem(true);
    try {
      if (isEditing && editingItem) {
        // Update existing item
        await handleUpdateItem();
      } else {
        // Add new item
        await handleAddItem();
      }
    } catch (err: any) {
      console.error('❌ Operation error:', err.response?.data || err.message);
      alert(`Failed to ${isEditing ? 'update' : 'add'} ${isManga ? 'chapter' : 'episode'}`);
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddItem = async () => {
    const endpoint = isManga ? '/chapters' : '/episodes';
    const requestBody = isManga
      ? {
          mangaId: selectedAnime.id,
          chapterNumber: newItem.number,
          title: newItem.title || `Chapter ${newItem.number}`,
          cutyLink: newItem.cutyLink,
          session: newItem.session
        }
      : {
          animeId: selectedAnime.id,
          episodeNumber: newItem.number,
          title: newItem.title || `Episode ${newItem.number}`,
          cutyLink: newItem.cutyLink,
          session: newItem.session
        };

    await axios.post(`${API_BASE}${endpoint}`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    alert(`${isManga ? 'Chapter' : 'Episode'} added successfully!`);
    resetForm();
    fetchContent(selectedAnime.id);
  };

  // ✅ NEW: Update Item Function
  const handleUpdateItem = async () => {
    if (!editingItem) return;

    const endpoint = isManga ? '/chapters' : '/episodes';
    const requestBody = isManga
      ? {
          mangaId: selectedAnime.id,
          chapterNumber: (editingItem as Chapter).chapterNumber, // Original number for lookup
          title: newItem.title || `Chapter ${newItem.number}`,
          cutyLink: newItem.cutyLink,
          session: newItem.session
        }
      : {
          animeId: selectedAnime.id,
          episodeNumber: (editingItem as Episode).episodeNumber, // Original number for lookup
          title: newItem.title || `Episode ${newItem.number}`,
          cutyLink: newItem.cutyLink,
          session: newItem.session
        };

    await axios.patch(`${API_BASE}${endpoint}`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    alert(`${isManga ? 'Chapter' : 'Episode'} updated successfully!`);
    resetForm();
    fetchContent(selectedAnime.id);
  };

  // ✅ NEW: Reset form
  const resetForm = () => {
    setIsEditing(false);
    setEditingItem(null);
    const nextNumber = getNextAvailableNumber();
    setNewItem({
      number: nextNumber,
      title: '',
      cutyLink: '',
      session: selectedSession
    });
  };

  const handleDeleteItem = async (itemId: string, itemNumber: number, session: number) => {
    if (!confirm(`Are you sure you want to delete ${isManga ? 'chapter' : 'episode'} ${itemNumber}?`)) return;

    try {
      const endpoint = isManga ? '/chapters' : '/episodes';
      await axios.delete(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          [isManga ? 'mangaId' : 'animeId']: selectedAnime?.id,
          [isManga ? 'chapterNumber' : 'episodeNumber']: itemNumber,
          session: session
        }
      });

      alert(`${isManga ? 'Chapter' : 'Episode'} deleted successfully!`);
      if (selectedAnime) {
        fetchContent(selectedAnime.id);
      }
    } catch (err: any) {
      console.error('❌ Delete error:', err.response?.data || err.message);
      alert(err.response?.data?.error || `Failed to delete ${isManga ? 'chapter' : 'episode'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Manage {isManga ? 'Chapters' : 'Episodes'}</h2>
        <button
          onClick={fetchAnimes}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          Refresh Content
        </button>
      </div>

      {/* Content Selection */}
      <div className="bg-slate-800/50 rounded-lg p-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Select {isManga ? 'Manga' : 'Anime/Movie'} *
        </label>
        <SearchableDropdown
          animes={animes}
          selectedAnime={selectedAnime}
          onAnimeSelect={setSelectedAnime}
          loading={animesLoading}
        />
      </div>

      {/* Selected Content Info */}
      {selectedAnime && (
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-2">
            Selected: {selectedAnime.title}
          </h3>
          <div className="flex gap-4 text-sm text-slate-300">
            <span>Type: {selectedAnime.contentType}</span>
            <span>Status: {selectedAnime.status}</span>
            <span>Total {isManga ? 'Chapters' : 'Episodes'}: {isManga ? chapters.length : episodes.length}</span>
          </div>
        </div>
      )}

      {/* Session Selector */}
      {selectedAnime && getAvailableSessions().length > 0 && (
        <div className="bg-slate-700/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Session
          </label>
          <div className="flex flex-wrap gap-2">
            {getAvailableSessions().map(session => (
              <button
                key={session}
                onClick={() => {
                  setSelectedSession(session);
                  setNewItem(prev => ({ ...prev, session }));
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedSession === session
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                Session {session}
              </button>
            ))}
            <button
              onClick={() => {
                const newSession = Math.max(...getAvailableSessions(), 0) + 1;
                setSelectedSession(newSession);
                setNewItem(prev => ({ ...prev, session: newSession, number: 1 }));
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              + New Session
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {selectedAnime && (
        <form onSubmit={handleSubmitItem} className="bg-slate-700/50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit' : 'Add New'} {isManga ? 'Chapter' : 'Episode'} {getAvailableSessions().length > 1 && `(Session ${selectedSession})`}
            {isEditing && <span className="text-yellow-400 ml-2">- Editing #{editingItem ? (isManga ? (editingItem as Chapter).chapterNumber : (editingItem as Episode).episodeNumber) : ''}</span>}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {isManga ? 'Chapter' : 'Episode'} Number *
              </label>
              <input
                type="number"
                value={newItem.number}
                onChange={(e) => setNewItem({
                  ...newItem,
                  number: Math.max(1, parseInt(e.target.value) || 1)
                })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                min="1"
                required
                disabled={isEditing} // Disable number editing to avoid conflicts
              />
              {isEditing && (
                <p className="text-xs text-yellow-400 mt-1">
                  Number cannot be changed when editing
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Session *
              </label>
              <input
                type="number"
                value={newItem.session}
                onChange={(e) => setNewItem({
                  ...newItem,
                  session: Math.max(1, parseInt(e.target.value) || 1)
                })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                min="1"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {isManga ? 'Chapter' : 'Episode'} Title
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder={`Optional - defaults to '${isManga ? 'Chapter' : 'Episode'} X'`}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cuty Link URL *
              </label>
              <input
                type="url"
                value={newItem.cutyLink}
                onChange={(e) => setNewItem({ ...newItem, cutyLink: e.target.value })}
                placeholder="https://cuty.io/..."
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addingItem || !selectedAnime}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {addingItem ? (
                <>
                  <Spinner size="sm" />
                  {isEditing ? 'Updating' : 'Adding'} {isManga ? 'Chapter' : 'Episode'}...
                </>
              ) : (
                `${isEditing ? 'Update' : 'Add'} ${isManga ? 'Chapter' : 'Episode'}`
              )}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      )}

      {/* Items List */}
      {selectedAnime && (
        <div className="bg-slate-800/50 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">
              {isManga ? 'Chapters' : 'Episodes'} List {getAvailableSessions().length > 1 && `(Session ${selectedSession})`}
              ({filteredItems.length})
            </h3>
            {loading && <Spinner size="sm" />}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" text={`Loading ${isManga ? 'chapters' : 'episodes'}...`} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No {isManga ? 'chapters' : 'episodes'} added yet for Session {selectedSession}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-700/30 rounded-lg overflow-hidden">
                <thead className="bg-slate-600/50">
                  <tr>
                    <th className="p-3 text-left text-slate-300 font-medium">#</th>
                    <th className="p-3 text-left text-slate-300 font-medium">Session</th>
                    <th className="p-3 text-left text-slate-300 font-medium">Title</th>
                    <th className="p-3 text-left text-slate-300 font-medium">Link</th>
                    <th className="p-3 text-left text-slate-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredItems.map((item: any) => (
                    <tr key={item._id} className="hover:bg-slate-600/30 transition-colors">
                      <td className="p-3 font-mono text-slate-300">
                        {isManga ? item.chapterNumber : item.episodeNumber}
                      </td>
                      <td className="p-3">
                        <span className="text-blue-400 bg-blue-600/20 px-2 py-1 rounded text-xs">
                          S{item.session || 1}
                        </span>
                      </td>
                      <td className="p-3 text-white">{item.title}</td>
                      <td className="p-3">
                        <a
                          href={item.cutyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-sm break-all"
                        >
                          {item.cutyLink.substring(0, 50)}...
                        </a>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {/* ✅ EDIT BUTTON */}
                          <button
                            onClick={() => handleEditItem(item)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition-colors"
                            title="Edit"
                          >
                            ✏️ Edit
                          </button>
                          
                          {/* DELETE BUTTON */}
                          <button
                            onClick={() => handleDeleteItem(item._id, isManga ? item.chapterNumber : item.episodeNumber, item.session || 1)}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors"
                            title="Delete"
                          >
                            🗑️ Delete
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
      )}
    </div>
  );
};

export default EpisodesManager;