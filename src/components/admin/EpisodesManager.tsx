// src/components/admin/EpisodesManager.tsx - COMPLETELY FIXED VERSION
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';
import SearchableDropdown from './SearchableDropdown';

// ✅ Define DownloadLink interface locally
interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

// ✅ Default download link names
const DEFAULT_LINK_NAMES = [
  'Cuty.io',
  'Shrinkme', 
  'Linkjust.com',
  'Gplinks',
  'Link 5'
];

const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing.onrender.com/api';
const token = localStorage.getItem('adminToken') || '';

const EpisodesManager: React.FC = () => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newItem, setNewItem] = useState({
    number: 1,
    title: '',
    session: 1,
    mainLink: '', // ✅ New field for main link
    downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }] as DownloadLink[]
  });
  const [loading, setLoading] = useState(true);
  const [animesLoading, setAnimesLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    number: 1,
    title: '',
    session: 1,
    mainLink: '', // ✅ New field for main link
    downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }] as DownloadLink[]
  });

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

  // ✅ REFRESH FUNCTION
  const handleRefresh = async () => {
    setAnimesLoading(true);
    try {
      // 1. Refresh anime list
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const updatedAnimes = data.map((a: any) => ({
        ...a,
        id: a._id || a.id
      }));
      
      setAnimes(updatedAnimes);
      
      // 2. If selected anime exists, refresh episodes/chapters
      if (selectedAnime) {
        const updatedSelectedAnime = updatedAnimes.find((a: Anime) => a.id === selectedAnime.id);
        
        if (updatedSelectedAnime) {
          setSelectedAnime(updatedSelectedAnime);
          await fetchContent(updatedSelectedAnime.id);
        } else {
          setSelectedAnime(null);
          setEpisodes([]);
          setChapters([]);
          alert('Previously selected content was removed from the list.');
        }
      }
      
      alert('Content refreshed successfully!');
    } catch (err: any) {
      console.error('❌ Refresh error:', err.response?.data || err.message);
      alert('Failed to refresh content');
    } finally {
      setAnimesLoading(false);
    }
  };

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
      setEditingItemId(null); // Reset editing state
    }
  }, [selectedAnime]);

  const fetchContent = async (contentId: string) => {
    setLoading(true);
    setEditingItemId(null); // Reset editing state on content change
    try {
      if (isManga) {
        const { data } = await axios.get(`${API_BASE}/chapters/${contentId}`);
        console.log('📥 Chapters API Response FULL DATA:', JSON.stringify(data, null, 2)); // ✅ Detailed log
        if (data && data.length > 0) {
          console.log('📊 First chapter COMPLETE DATA:', data[0]);
          console.log('🔍 mainLink exists?', data[0].hasOwnProperty('mainLink'));
          console.log('🔍 mainLink value:', data[0].mainLink);
          console.log('🔍 mainLink type:', typeof data[0].mainLink);
        }
        setChapters(data);
        const lastChapter = data.filter((ch: Chapter) => (ch.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastChapter.length > 0 ? Math.max(...lastChapter.map((ch: Chapter) => ch.chapterNumber)) + 1 : 1,
          session: selectedSession,
          mainLink: '', // Reset main link
          downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
        }));
      } else {
        const { data } = await axios.get(`${API_BASE}/episodes/${contentId}`);
        console.log('📥 Episodes API Response FULL DATA:', JSON.stringify(data, null, 2)); // ✅ Detailed log
        if (data && data.length > 0) {
          console.log('📊 First episode COMPLETE DATA:', data[0]);
          console.log('🔍 mainLink exists?', data[0].hasOwnProperty('mainLink'));
          console.log('🔍 mainLink value:', data[0].mainLink);
          console.log('🔍 mainLink type:', typeof data[0].mainLink);
          console.log('🔍 ALL FIELDS:', Object.keys(data[0]));
        }
        setEpisodes(data);
        const lastEpisode = data.filter((ep: Episode) => (ep.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastEpisode.length > 0 ? Math.max(...lastEpisode.map((ep: Episode) => ep.episodeNumber)) + 1 : 1,
          session: selectedSession,
          mainLink: '', // Reset main link
          downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
        }));
      }
    } catch (err: any) {
      console.error('❌ Content load error:', err.response?.data || err.message);
      alert('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit Item
  const handleEditItem = (item: Episode | Chapter) => {
    if (editingItemId === (item as any)._id) {
      // If clicking on already editing item, cancel edit
      setEditingItemId(null);
    } else {
      setEditingItemId((item as any)._id);
      
      // ✅ Get downloadLinks and mainLink from item - FIXED
      const itemData = item as any;
      const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
      
      // ✅ CRITICAL FIX: mainLink को सही तरीके से लें
      let mainLink = '';
      if (itemData.mainLink !== undefined && itemData.mainLink !== null) {
        mainLink = itemData.mainLink;
      } else if (itemData.hasOwnProperty('mainLink')) {
        mainLink = itemData.mainLink || '';
      } else {
        mainLink = '';
      }
      
      console.log('✏️ Editing item DETAILED:', {
        title: item.title,
        mainLink: mainLink,
        hasMainLink: itemData.hasOwnProperty('mainLink'),
        itemData: itemData
      });
      
      // If no download links, add one default with default name
      const linksToSet = downloadLinks.length > 0 
        ? downloadLinks 
        : [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }];
      
      setEditForm({
        number: isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber,
        title: item.title || '',
        session: item.session || 1,
        mainLink: mainLink, // Set main link from item
        downloadLinks: linksToSet
      });
    }
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  // Get next available number
  const getNextAvailableNumber = () => {
    if (filteredItems.length === 0) return 1;
    const numbers = filteredItems.map(item => isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber);
    return Math.max(...numbers) + 1;
  };

  // ✅ Add a new download link (for add form)
  const handleAddDownloadLink = () => {
    if (newItem.downloadLinks.length >= 5) {
      alert('Maximum 5 download links allowed');
      return;
    }
    
    setNewItem(prev => ({
      ...prev,
      downloadLinks: [
        ...prev.downloadLinks,
        { 
          name: DEFAULT_LINK_NAMES[prev.downloadLinks.length] || `Download Link ${prev.downloadLinks.length + 1}`, 
          url: '', 
          quality: '', 
          type: 'direct' 
        }
      ]
    }));
  };

  // ✅ Add a new download link (for edit form)
  const handleEditAddDownloadLink = () => {
    if (editForm.downloadLinks.length >= 5) {
      alert('Maximum 5 download links allowed');
      return;
    }
    
    setEditForm(prev => ({
      ...prev,
      downloadLinks: [
        ...prev.downloadLinks,
        { 
          name: DEFAULT_LINK_NAMES[prev.downloadLinks.length] || `Download Link ${prev.downloadLinks.length + 1}`, 
          url: '', 
          quality: '', 
          type: 'direct' 
        }
      ]
    }));
  };

  // ✅ Remove a download link (for add form)
  const handleRemoveDownloadLink = (index: number) => {
    if (newItem.downloadLinks.length <= 1) {
      alert('At least one download link is required');
      return;
    }
    
    setNewItem(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.filter((_, i) => i !== index)
    }));
  };

  // ✅ Remove a download link (for edit form)
  const handleEditRemoveDownloadLink = (index: number) => {
    if (editForm.downloadLinks.length <= 1) {
      alert('At least one download link is required');
      return;
    }
    
    setEditForm(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.filter((_, i) => i !== index)
    }));
  };

  // ✅ Update download link (for add form)
  const handleUpdateDownloadLink = (index: number, field: keyof DownloadLink, value: string) => {
    setNewItem(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  // ✅ Update download link (for edit form)
  const handleEditUpdateDownloadLink = (index: number, field: keyof DownloadLink, value: string) => {
    setEditForm(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  // ✅ Validate download links (for add form)
  const validateDownloadLinks = (links: DownloadLink[]): boolean => {
    if (links.length === 0) {
      alert('At least one download link is required');
      return false;
    }
    
    if (links.length > 5) {
      alert('Maximum 5 download links allowed');
      return false;
    }
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.name.trim()) {
        alert(`Download link ${i + 1} must have a name`);
        return false;
      }
      if (!link.url.trim()) {
        alert(`Download link ${i + 1} must have a URL`);
        return false;
      }
      if (!link.url.startsWith('http')) {
        alert(`Download link ${i + 1} must be a valid URL starting with http:// or https://`);
        return false;
      }
    }
    
    return true;
  };

  // Add New Item Function
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnime) {
      alert('Please select content first');
      return;
    }

    // ✅ Validate download links
    if (!validateDownloadLinks(newItem.downloadLinks)) {
      return;
    }

    setAddingItem(true);
    try {
      const endpoint = isManga ? '/chapters' : '/episodes';
      const requestBody = isManga
        ? {
            mangaId: selectedAnime.id,
            chapterNumber: newItem.number,
            title: newItem.title || `Chapter ${newItem.number}`,
            session: newItem.session,
            mainLink: newItem.mainLink || '', // ✅ Send empty string instead of undefined
            downloadLinks: newItem.downloadLinks
          }
        : {
            animeId: selectedAnime.id,
            episodeNumber: newItem.number,
            title: newItem.title || `Episode ${newItem.number}`,
            session: newItem.session,
            mainLink: newItem.mainLink || '', // ✅ Send empty string instead of undefined
            downloadLinks: newItem.downloadLinks
          };

      console.log('📤 Sending POST request with mainLink:', requestBody.mainLink);
      
      const response = await axios.post(`${API_BASE}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      console.log('✅ POST Response:', response.data);
      
      alert(`${isManga ? 'Chapter' : 'Episode'} added successfully!`);
      
      // Reset form with default name
      const nextNumber = getNextAvailableNumber();
      setNewItem({
        number: nextNumber,
        title: '',
        session: selectedSession,
        mainLink: '', // Reset main link
        downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
      });
      
      fetchContent(selectedAnime.id);
    } catch (err: any) {
      console.error('❌ Add error:', err.response?.data || err.message);
      alert(`Failed to add ${isManga ? 'chapter' : 'episode'}`);
    } finally {
      setAddingItem(false);
    }
  };

  // Update Item Function
  const handleUpdateItem = async () => {
    if (!editingItemId || !selectedAnime) return;

    // ✅ Validate download links
    if (!validateDownloadLinks(editForm.downloadLinks)) {
      return;
    }

    try {
      const endpoint = isManga ? '/chapters' : '/episodes';
      const requestBody = isManga
        ? {
            mangaId: selectedAnime.id,
            chapterNumber: editForm.number,
            title: editForm.title || `Chapter ${editForm.number}`,
            session: editForm.session,
            mainLink: editForm.mainLink || '', // ✅ Send empty string instead of undefined
            downloadLinks: editForm.downloadLinks
          }
        : {
            animeId: selectedAnime.id,
            episodeNumber: editForm.number,
            title: editForm.title || `Episode ${editForm.number}`,
            session: editForm.session,
            mainLink: editForm.mainLink || '', // ✅ Send empty string instead of undefined
            downloadLinks: editForm.downloadLinks
          };

      console.log('📤 Sending PATCH request with mainLink:', requestBody.mainLink);
      
      const response = await axios.patch(`${API_BASE}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      console.log('✅ PATCH Response:', response.data);
      
      alert(`${isManga ? 'Chapter' : 'Episode'} updated successfully!`);
      setEditingItemId(null);
      fetchContent(selectedAnime.id);
    } catch (err: any) {
      console.error('❌ Update error:', err.response?.data || err.message);
      alert(`Failed to update ${isManga ? 'chapter' : 'episode'}`);
    }
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

  // ✅ Function to open main link in new tab
  const openMainLink = (link: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Manage {isManga ? 'Chapters' : 'Episodes'}</h2>
        <button
          onClick={handleRefresh}
          disabled={animesLoading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
        >
          {animesLoading ? (
            <>
              <Spinner size="sm" />
              Refreshing...
            </>
          ) : (
            '🔄 Refresh Content'
          )}
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
                  setEditingItemId(null); // Cancel edit when changing session
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
                setEditingItemId(null); // Cancel edit when adding new session
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              + New Session
            </button>
          </div>
        </div>
      )}

      {/* Add New Item Form */}
      {selectedAnime && (
        <form onSubmit={handleAddItem} className="bg-slate-700/50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Add New {isManga ? 'Chapter' : 'Episode'} {getAvailableSessions().length > 1 && `(Session ${selectedSession})`}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              />
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
          </div>

          {/* ✅ MAIN LINK SECTION - FOR ADMIN ONLY */}
          <div className="bg-slate-800/70 p-4 rounded-lg border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-yellow-300">
                🔗 Main Link (Admin Only - Optional)
              </label>
              <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">Internal Use</span>
            </div>
            <p className="text-slate-400 text-xs mb-3">
              This is for admin reference only. It won't be shown to users. Use it to store the original source link or internal notes.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem.mainLink}
                onChange={(e) => setNewItem({ ...newItem, mainLink: e.target.value })}
                placeholder="https://example.com/original-source.mp4"
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
              />
              <button
                type="button"
                onClick={() => openMainLink(newItem.mainLink)}
                disabled={!newItem.mainLink}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-1"
                title="Open in new tab"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newItem.mainLink) {
                    navigator.clipboard.writeText(newItem.mainLink);
                    alert('Main link copied to clipboard!');
                  }
                }}
                disabled={!newItem.mainLink}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-1"
                title="Copy to clipboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
          </div>

          {/* DOWNLOAD LINKS SECTION - FOR ADD FORM */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-300">
                User Download Links (Required) *
              </label>
              <button
                type="button"
                onClick={handleAddDownloadLink}
                disabled={newItem.downloadLinks.length >= 5}
                className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-2 py-1 rounded"
              >
                + Add Link (Max 5)
              </button>
            </div>
            
            <div className="space-y-3">
              {newItem.downloadLinks.map((link, index) => (
                <div key={index} className="bg-slate-800/70 p-3 rounded-lg border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">{link.name}</span>
                    {newItem.downloadLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDownloadLink(index)}
                        className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Link Name *</label>
                      <input
                        type="text"
                        value={link.name}
                        onChange={(e) => handleUpdateDownloadLink(index, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g., Cuty.io, Shrinkme, etc."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Quality (Optional)</label>
                      <input
                        type="text"
                        value={link.quality || ''}
                        onChange={(e) => handleUpdateDownloadLink(index, 'quality', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g., 720p, HD, 1080p"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1">Download URL *</label>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateDownloadLink(index, 'url', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                      placeholder="https://example.com/download/video.mp4"
                      required
                    />
                  </div>
                  
                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1">Type (Optional)</label>
                    <select
                      value={link.type || 'direct'}
                      onChange={(e) => handleUpdateDownloadLink(index, 'type', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="direct">Direct Download</option>
                      <option value="server">Server Download</option>
                      <option value="google_drive">Google Drive</option>
                      <option value="mega">Mega.nz</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-slate-400 text-xs mt-2">
              💡 These download links will be shown to users. You can add up to 5 links. At least one link with name and URL is required.
            </p>
          </div>

          <div>
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

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addingItem || !selectedAnime}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {addingItem ? (
                <>
                  <Spinner size="sm" />
                  Adding {isManga ? 'Chapter' : 'Episode'}...
                </>
              ) : (
                `Add ${isManga ? 'Chapter' : 'Episode'}`
              )}
            </button>
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
                    <th className="p-3 text-left text-slate-300 font-medium">Main Link (Admin)</th>
                    <th className="p-3 text-left text-slate-300 font-medium">User Download Links</th>
                    <th className="p-3 text-left text-slate-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredItems.map((item: any, index: number) => {
                    const downloadLinks: DownloadLink[] = item.downloadLinks || [];
                    
                    // ✅ CRITICAL FIX: mainLink को सही तरीके से access करें
                    let mainLink = '';
                    
                    // Method 1: Direct property check
                    if (item.mainLink !== undefined && item.mainLink !== null) {
                      mainLink = item.mainLink;
                    } 
                    // Method 2: Check if property exists
                    else if (Object.prototype.hasOwnProperty.call(item, 'mainLink')) {
                      mainLink = item.mainLink || '';
                    }
                    // Method 3: Type casting
                    else {
                      mainLink = (item as any).mainLink || '';
                    }
                    
                    const isEditing = editingItemId === item._id;
                    
                    // ✅ EXTENDED DEBUG LOG
                    console.log(`🔍 DEBUG Item ${index + 1}:`, {
                      title: item.title,
                      number: isManga ? item.chapterNumber : item.episodeNumber,
                      mainLinkValue: mainLink,
                      itemMainLinkProperty: item.mainLink,
                      hasMainLinkProp: item.hasOwnProperty('mainLink'),
                      mainLinkType: typeof item.mainLink,
                      allProperties: Object.keys(item),
                      fullItem: item // सावधान: बड़ा output हो सकता है
                    });
                    
                    return (
                      <React.Fragment key={item._id}>
                        <tr className={`hover:bg-slate-600/30 transition-colors ${isEditing ? 'bg-slate-700/50' : ''}`}>
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
                            {/* ✅ FIXED RENDERING - Better condition check */}
                            {mainLink && mainLink.trim() !== '' ? (
                              <div className="space-y-2">
                                <div className="text-xs">
                                  <span className="text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded mr-2">Admin</span>
                                  <span 
                                    className="text-yellow-300 truncate block max-w-xs cursor-help" 
                                    title={mainLink}
                                    onClick={() => {
                                      navigator.clipboard.writeText(mainLink);
                                      alert('Main link copied to clipboard!');
                                    }}
                                  >
                                    {mainLink.length > 30 ? mainLink.substring(0, 30) + '...' : mainLink}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => window.open(mainLink, '_blank', 'noopener,noreferrer')}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1"
                                    title="Open in new tab"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(mainLink);
                                      alert('Main link copied to clipboard!');
                                    }}
                                    className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded flex items-center gap-1"
                                    title="Copy to clipboard"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs italic">No main link</span>
                            )}
                          </td>
                          <td className="p-3">
                            {downloadLinks.length > 0 ? (
                              <div className="space-y-1">
                                {downloadLinks.slice(0, 2).map((link, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-blue-400 font-medium">{link.name}:</span>
                                    <a 
                                      href={link.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 ml-1 truncate block max-w-xs"
                                      title={link.url}
                                    >
                                      {link.url.substring(0, 40)}...
                                    </a>
                                  </div>
                                ))}
                                {downloadLinks.length > 2 && (
                                  <div className="text-green-400 text-xs">
                                    + {downloadLinks.length - 2} more link{downloadLinks.length - 2 > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-sm">No download links</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditItem(item)}
                                className={`px-3 py-1 rounded text-sm transition-colors ${
                                  isEditing 
                                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                                title={isEditing ? "Cancel Edit" : "Edit"}
                              >
                                {isEditing ? '❌ Cancel Edit' : '✏️ Edit'}
                              </button>
                              {!isEditing && (
                                <button
                                  onClick={() => handleDeleteItem(item._id, isManga ? item.chapterNumber : item.episodeNumber, item.session || 1)}
                                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors"
                                  title="Delete"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* EDIT FORM ROW - Appears below the episode/chapter */}
                        {isEditing && (
                          <tr className="bg-slate-800/70 border-b border-slate-700">
                            <td colSpan={6} className="p-4">
                              <div className="border-l-4 border-yellow-500 pl-4 py-3">
                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit {isManga ? 'Chapter' : 'Episode'} #{editForm.number}
                                </h4>
                                
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        {isManga ? 'Chapter' : 'Episode'} Number *
                                      </label>
                                      <input
                                        type="number"
                                        value={editForm.number}
                                        onChange={(e) => setEditForm({
                                          ...editForm,
                                          number: Math.max(1, parseInt(e.target.value) || 1)
                                        })}
                                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                        min="1"
                                        required
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Session *
                                      </label>
                                      <input
                                        type="number"
                                        value={editForm.session}
                                        onChange={(e) => setEditForm({
                                          ...editForm,
                                          session: Math.max(1, parseInt(e.target.value) || 1)
                                        })}
                                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                        min="1"
                                        required
                                      />
                                    </div>
                                  </div>

                                  {/* ✅ MAIN LINK SECTION - FOR EDIT FORM */}
                                  <div className="bg-slate-800/70 p-4 rounded-lg border-l-4 border-yellow-500">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="block text-sm font-medium text-yellow-300">
                                        🔗 Main Link (Admin Only - Optional)
                                      </label>
                                      <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">Internal Use</span>
                                    </div>
                                    <p className="text-slate-400 text-xs mb-3">
                                      This is for admin reference only. It won't be shown to users.
                                    </p>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={editForm.mainLink}
                                        onChange={(e) => setEditForm({ ...editForm, mainLink: e.target.value })}
                                        placeholder="https://example.com/original-source.mp4"
                                        className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => openMainLink(editForm.mainLink)}
                                        disabled={!editForm.mainLink}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-1"
                                        title="Open in new tab"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Open
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (editForm.mainLink) {
                                            navigator.clipboard.writeText(editForm.mainLink);
                                            alert('Main link copied to clipboard!');
                                          }
                                        }}
                                        disabled={!editForm.mainLink}
                                        className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition-colors flex items-center gap-1"
                                        title="Copy to clipboard"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy
                                      </button>
                                    </div>
                                  </div>

                                  {/* DOWNLOAD LINKS SECTION - FOR EDIT FORM */}
                                  <div>
                                    <div className="flex justify-between items-center mb-2">
                                      <label className="block text-sm font-medium text-slate-300">
                                        User Download Links (Required) *
                                      </label>
                                      <button
                                        type="button"
                                        onClick={handleEditAddDownloadLink}
                                        disabled={editForm.downloadLinks.length >= 5}
                                        className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-2 py-1 rounded"
                                      >
                                        + Add Link (Max 5)
                                      </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      {editForm.downloadLinks.map((link, index) => (
                                        <div key={index} className="bg-slate-900/70 p-3 rounded-lg border border-slate-600">
                                          <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-300 font-medium">{link.name}</span>
                                            {editForm.downloadLinks.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleEditRemoveDownloadLink(index)}
                                                className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                                              >
                                                Remove
                                              </button>
                                            )}
                                          </div>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs text-slate-400 mb-1">Link Name *</label>
                                              <input
                                                type="text"
                                                value={link.name}
                                                onChange={(e) => handleEditUpdateDownloadLink(index, 'name', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                                placeholder="e.g., Cuty.io, Shrinkme, etc."
                                                required
                                              />
                                            </div>
                                            
                                            <div>
                                              <label className="block text-xs text-slate-400 mb-1">Quality (Optional)</label>
                                              <input
                                                type="text"
                                                value={link.quality || ''}
                                                onChange={(e) => handleEditUpdateDownloadLink(index, 'quality', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                                placeholder="e.g., 720p, HD, 1080p"
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="mt-3">
                                            <label className="block text-xs text-slate-400 mb-1">Download URL *</label>
                                            <input
                                              type="url"
                                              value={link.url}
                                              onChange={(e) => handleEditUpdateDownloadLink(index, 'url', e.target.value)}
                                              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                              placeholder="https://example.com/download/video.mp4"
                                              required
                                            />
                                          </div>
                                          
                                          <div className="mt-3">
                                            <label className="block text-xs text-slate-400 mb-1">Type (Optional)</label>
                                            <select
                                              value={link.type || 'direct'}
                                              onChange={(e) => handleEditUpdateDownloadLink(index, 'type', e.target.value)}
                                              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                            >
                                              <option value="direct">Direct Download</option>
                                              <option value="server">Server Download</option>
                                              <option value="google_drive">Google Drive</option>
                                              <option value="mega">Mega.nz</option>
                                              <option value="other">Other</option>
                                            </select>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                      {isManga ? 'Chapter' : 'Episode'} Title
                                    </label>
                                    <input
                                      type="text"
                                      value={editForm.title}
                                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                      placeholder={`Optional - defaults to '${isManga ? 'Chapter' : 'Episode'} X'`}
                                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                                    />
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      type="button"
                                      onClick={handleUpdateItem}
                                      className="bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-4 rounded text-sm transition-colors flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Save Changes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
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
          )}
        </div>
      )}
    </div>
  );
};

export default EpisodesManager;