 // src/components/admin/EpisodesManager.tsx - No emojis, custom SVG icons, mobile-friendly
import React, { useState, useEffect } from 'react';
import type { Anime, Episode, Chapter } from '../../types';
import axios from 'axios';
import Spinner from '../Spinner';
import SearchableDropdown from './SearchableDropdown';
import toast from 'react-hot-toast';
import { getContentGroup } from '../../utils/contentGroup';

interface DownloadLink {
  name: string;
  url: string;
  quality?: string;
  type?: string;
}

const DEFAULT_LINK_NAMES = [
  'Cuty.io',
  'Shrinkme',
  'Linkjust.com',
  'Gplinks',
  'Link 5'
];

const API_BASE = import.meta.env.VITE_API_BASE || 
  'https://animabing-backend.animabingwatch.workers.dev/api';

interface EpisodesManagerProps {
  token?: string;
  isMainAdmin?: boolean;
}

// Inline SVG icon components to replace emojis
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const CrownIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16l2-8 5 4 5-4 2 8H5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 20h18" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const CancelIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const EpisodesManager: React.FC<EpisodesManagerProps> = ({ token: tokenProp, isMainAdmin = false }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [animes, setAnimes] = useState<Anime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newItem, setNewItem] = useState({
    number: 1,
    title: '',
    session: 1,
    mainLink: '',
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
    mainLink: '',
    downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }] as DownloadLink[]
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ itemId: string; itemNumber: number; session: number } | null>(null);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [downloadPages, setDownloadPages] = useState<any[]>([]);
  const [loadingDownloadPages, setLoadingDownloadPages] = useState(false);

  const isManga = getContentGroup(selectedAnime?.contentType) === 'chapter';

  const getAvailableSessions = () => {
    const items = isManga ? chapters : episodes;
    const sessions = new Set<number>();
    items.forEach(item => sessions.add(item.session || 1));
    return Array.from(sessions).sort((a, b) => a - b);
  };

  const filteredItems = (isManga ? chapters : episodes).filter(item => (item.session || 1) === selectedSession);

  useEffect(() => {
    fetchAnimes();
  }, []);

  const fetchAnimes = async () => {
    setAnimesLoading(true);
    try {
      const token = getToken();
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnimes(data.map((a: any) => ({
        ...a,
        id: a._id || a.id,
        _id: a._id || a.id
      })));
    } catch (err: any) {
      console.error('Animes load error:', err.response?.data || err.message);
      toast.error('Failed to load animes');
    } finally {
      setAnimesLoading(false);
    }
  };

  const handleRefresh = async () => {
    setAnimesLoading(true);
    try {
      const token = getToken();
      const { data } = await axios.get(`${API_BASE}/admin/protected/anime-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedAnimes = data.map((a: any) => ({
        ...a,
        id: a._id || a.id,
        _id: a._id || a.id
      }));
      setAnimes(updatedAnimes);

      if (selectedAnime) {
        const updatedSelectedAnime = updatedAnimes.find((a: Anime) => a._id === selectedAnime._id);
        if (updatedSelectedAnime) {
          setSelectedAnime(updatedSelectedAnime);
          await fetchContent(updatedSelectedAnime._id);
          await fetchDownloadPagesForAnime(updatedSelectedAnime._id);
        } else {
          setSelectedAnime(null);
          setEpisodes([]);
          setChapters([]);
          setDownloadPages([]);
          toast.error('Previously selected content was removed from the list.');
        }
      }
      toast.success('Content refreshed successfully!');
    } catch (err: any) {
      console.error('Refresh error:', err.response?.data || err.message);
      toast.error('Failed to refresh content');
    } finally {
      setAnimesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAnime) {
      fetchContent(selectedAnime._id);
      fetchDownloadPagesForAnime(selectedAnime._id);
    } else {
      setEpisodes([]);
      setChapters([]);
      setDownloadPages([]);
      setEditingItemId(null);
    }
  }, [selectedAnime]);

  const transformEpisodeData = (data: any): Episode => ({
    ...data,
    mainLink: data.mainLink || (data.downloadLinks && data.downloadLinks.length > 0 ? data.downloadLinks[0].url : '')
  });

  const transformChapterData = (data: any): Chapter => ({
    ...data,
    mainLink: data.mainLink || (data.downloadLinks && data.downloadLinks.length > 0 ? data.downloadLinks[0].url : '')
  });

  const fetchContent = async (contentId: string) => {
    setLoading(true);
    setEditingItemId(null);
    try {
      const token = getToken();
      if (isManga) {
        const { data } = await axios.get(`${API_BASE}/chapters/${contentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const transformed = data.map(transformChapterData);
        setChapters(transformed);
        const lastItem = transformed.filter((ch: Chapter) => (ch.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastItem.length > 0 ? Math.max(...lastItem.map((ch: Chapter) => ch.chapterNumber)) + 1 : 1,
          session: selectedSession,
          mainLink: '',
          downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
        }));
      } else {
        const { data } = await axios.get(`${API_BASE}/episodes/${contentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const transformed = data.map(transformEpisodeData);
        setEpisodes(transformed);
        const lastItem = transformed.filter((ep: Episode) => (ep.session || 1) === selectedSession);
        setNewItem(prev => ({
          ...prev,
          number: lastItem.length > 0 ? Math.max(...lastItem.map((ep: Episode) => ep.episodeNumber)) + 1 : 1,
          session: selectedSession,
          mainLink: '',
          downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
        }));
      }
    } catch (err: any) {
      console.error('Content load error:', err.response?.data || err.message);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloadPagesForAnime = async (animeId: string) => {
    setLoadingDownloadPages(true);
    try {
      const { data } = await axios.get(`${API_BASE}/download-pages/anime/${animeId}`);
      setDownloadPages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Download pages load error:', err.response?.data || err.message);
      setDownloadPages([]);
    } finally {
      setLoadingDownloadPages(false);
    }
  };

  const handleEditItem = (item: Episode | Chapter) => {
    if (editingItemId === (item as any)._id) {
      setEditingItemId(null);
    } else {
      setEditingItemId((item as any)._id);
      const itemData = item as any;
      const downloadLinks: DownloadLink[] = itemData.downloadLinks || [];
      const mainLink = itemData.mainLink || '';
      setEditForm({
        number: isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber,
        title: item.title || '',
        session: item.session || 1,
        mainLink: mainLink,
        downloadLinks: downloadLinks.length > 0 ? downloadLinks : [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
      });
    }
  };

  const handleCancelEdit = () => setEditingItemId(null);

  const getNextAvailableNumber = () => {
    if (filteredItems.length === 0) return 1;
    const numbers = filteredItems.map(item => isManga ? (item as Chapter).chapterNumber : (item as Episode).episodeNumber);
    return Math.max(...numbers) + 1;
  };

  const handleAddDownloadLink = () => {
    if (newItem.downloadLinks.length >= 5) {
      toast.error('Maximum 5 download links allowed');
      return;
    }
    setNewItem(prev => ({
      ...prev,
      downloadLinks: [
        ...prev.downloadLinks,
        { name: DEFAULT_LINK_NAMES[prev.downloadLinks.length] || `Link ${prev.downloadLinks.length + 1}`, url: '', quality: '', type: 'direct' }
      ]
    }));
  };

  const handleEditAddDownloadLink = () => {
    if (editForm.downloadLinks.length >= 5) {
      toast.error('Maximum 5 download links allowed');
      return;
    }
    setEditForm(prev => ({
      ...prev,
      downloadLinks: [
        ...prev.downloadLinks,
        { name: DEFAULT_LINK_NAMES[prev.downloadLinks.length] || `Link ${prev.downloadLinks.length + 1}`, url: '', quality: '', type: 'direct' }
      ]
    }));
  };

  const handleRemoveDownloadLink = (index: number) => {
    if (newItem.downloadLinks.length <= 1) {
      toast.error('At least one download link is required');
      return;
    }
    setNewItem(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.filter((_, i) => i !== index)
    }));
  };

  const handleEditRemoveDownloadLink = (index: number) => {
    if (editForm.downloadLinks.length <= 1) {
      toast.error('At least one download link is required');
      return;
    }
    setEditForm(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateDownloadLink = (index: number, field: keyof DownloadLink, value: string) => {
    setNewItem(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.map((link, i) => i === index ? { ...link, [field]: value } : link)
    }));
  };

  const handleEditUpdateDownloadLink = (index: number, field: keyof DownloadLink, value: string) => {
    setEditForm(prev => ({
      ...prev,
      downloadLinks: prev.downloadLinks.map((link, i) => i === index ? { ...link, [field]: value } : link)
    }));
  };

  const handleAutoGenerateLinks = async (isEdit: boolean = false, externalLink?: string) => {
    const link = externalLink || (isEdit ? editForm.mainLink : newItem.mainLink);
    if (!link || !link.startsWith('http')) {
      toast.error('Pehle valid Main Link daalo');
      return;
    }
    setGeneratingLinks(true);
    try {
      const token = getToken();
      const { data } = await axios.post(
        `${API_BASE}/link-generator/generate`,
        { url: link },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newLinks: DownloadLink[] = DEFAULT_LINK_NAMES.map((name) => ({
        name,
        url: data[name] || '',
        quality: '',
        type: name === 'Link 5' ? 'direct' : 'server'
      }));

      setNewItem(prev => ({
        ...prev,
        mainLink: link,
        downloadLinks: newLinks
      }));

      toast.success('4 short links + 1 direct link neeche form me add ho gaye!');
    } catch (err: any) {
      console.error('Auto-generate error:', err.response?.data || err.message);
      toast.error('Link generate karne me error aaya');
    } finally {
      setGeneratingLinks(false);
    }
  };

  const validateDownloadLinks = (links: DownloadLink[]): boolean => {
    if (links.length === 0) {
      toast.error('At least one download link is required');
      return false;
    }
    if (links.length > 5) {
      toast.error('Maximum 5 download links allowed');
      return false;
    }
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.name.trim()) {
        toast.error(`Download link ${i + 1} must have a name`);
        return false;
      }
      if (!link.url.trim()) {
        toast.error(`Download link ${i + 1} must have a URL`);
        return false;
      }
      if (!link.url.startsWith('http')) {
        toast.error(`Download link ${i + 1} must be a valid URL starting with http:// or https://`);
        return false;
      }
    }
    return true;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnime) {
      toast.error('Please select content first');
      return;
    }
    if (!validateDownloadLinks(newItem.downloadLinks)) return;

    setAddingItem(true);
    try {
      const token = getToken();
      const endpoint = isManga ? '/chapters' : '/episodes';
      const requestBody = isManga
        ? {
            mangaId: selectedAnime._id,
            chapterNumber: newItem.number,
            title: newItem.title || `Chapter ${newItem.number}`,
            session: newItem.session,
            mainLink: newItem.mainLink,
            downloadLinks: newItem.downloadLinks
          }
        : {
            animeId: selectedAnime._id,
            episodeNumber: newItem.number,
            title: newItem.title || `Episode ${newItem.number}`,
            session: newItem.session,
            mainLink: newItem.mainLink,
            downloadLinks: newItem.downloadLinks
          };

      const response = await axios.post(`${API_BASE}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      toast.success(`${isManga ? 'Chapter' : 'Episode'} added successfully!`);

      if (isManga) {
        setChapters(prev => [...prev, transformChapterData(response.data.episode || response.data)]);
      } else {
        setEpisodes(prev => [...prev, transformEpisodeData(response.data.episode || response.data)]);
      }

      const nextNumber = getNextAvailableNumber();
      setNewItem({
        number: nextNumber,
        title: '',
        session: selectedSession,
        mainLink: '',
        downloadLinks: [{ name: DEFAULT_LINK_NAMES[0], url: '', quality: '', type: 'direct' }]
      });
    } catch (err: any) {
      console.error('Add error:', err.response?.data || err.message);
      toast.error(`Failed to add ${isManga ? 'chapter' : 'episode'}: ${err.response?.data?.error || err.message}`);
    } finally {
      setAddingItem(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItemId || !selectedAnime) return;
    if (!validateDownloadLinks(editForm.downloadLinks)) return;

    try {
      const token = getToken();
      const endpoint = isManga ? '/chapters' : '/episodes';
      const requestBody = isManga
        ? {
            mangaId: selectedAnime._id,
            chapterNumber: editForm.number,
            title: editForm.title || `Chapter ${editForm.number}`,
            session: editForm.session,
            mainLink: editForm.mainLink,
            downloadLinks: editForm.downloadLinks
          }
        : {
            animeId: selectedAnime._id,
            episodeNumber: editForm.number,
            title: editForm.title || `Episode ${editForm.number}`,
            session: editForm.session,
            mainLink: editForm.mainLink,
            downloadLinks: editForm.downloadLinks
          };

      await axios.patch(`${API_BASE}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      toast.success(`${isManga ? 'Chapter' : 'Episode'} updated successfully!`);
      setEditingItemId(null);
      await fetchContent(selectedAnime._id);
    } catch (err: any) {
      console.error('Update error:', err.response?.data || err.message);
      toast.error(`Failed to update ${isManga ? 'chapter' : 'episode'}: ${err.response?.data?.error || err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !selectedAnime) return;
    const { itemId, itemNumber, session } = deleteConfirm;
    try {
      const token = getToken();
      const endpoint = isManga ? '/chapters' : '/episodes';
      await axios.delete(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          [isManga ? 'mangaId' : 'animeId']: selectedAnime._id,
          [isManga ? 'chapterNumber' : 'episodeNumber']: itemNumber,
          session: session
        }
      });
      toast.success(`${isManga ? 'Chapter' : 'Episode'} deleted successfully!`);
      await fetchContent(selectedAnime._id);
    } catch (err: any) {
      console.error('Delete error:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || `Failed to delete ${isManga ? 'chapter' : 'episode'}`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openMainLink = (link: string) => link && window.open(link, '_blank', 'noopener,noreferrer');

  const copyToClipboard = (text: string, message: string = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  // ✅ Shared edit form for an item — used in both desktop table row and mobile card
  const renderEditForm = (item: any) => (
    <div className="border-l-4 border-yellow-500 pl-4 py-3">
      <h4 className="text-base sm:text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <EditIcon />
        Edit {isManga ? 'Chapter' : 'Episode'} #{editForm.number}
      </h4>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-sm text-slate-300">Number *</label>
            <input type="number" value={editForm.number} onChange={(e) => setEditForm({...editForm, number: Math.max(1, parseInt(e.target.value)||1)})} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-sm text-slate-300">Session *</label>
            <input type="number" value={editForm.session} onChange={(e) => setEditForm({...editForm, session: Math.max(1, parseInt(e.target.value)||1)})} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div className="bg-slate-800/70 p-3 sm:p-4 rounded-lg border-l-4 border-yellow-500">
          <label className="block text-sm font-medium text-yellow-300">Main Link (Admin)</label>
          <input type="text" value={editForm.mainLink} onChange={(e) => setEditForm({...editForm, mainLink: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2.5 text-sm mt-2" />
          {isMainAdmin && (
            <button
              type="button"
              onClick={() => handleAutoGenerateLinks(true)}
              disabled={!editForm.mainLink || generatingLinks}
              className="mt-2 w-full sm:w-auto justify-center bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
            >
              {generatingLinks ? <Spinner size="sm" /> : <BoltIcon />} Auto-Generate 5 Links
            </button>
          )}
        </div>
        <div>
          <div className="flex justify-between items-center">
            <label className="text-sm text-slate-300">User Download Links</label>
            <button type="button" onClick={handleEditAddDownloadLink} disabled={editForm.downloadLinks.length>=5} className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-2 py-1.5 rounded">+ Add</button>
          </div>
          <div className="space-y-3 mt-2">
            {editForm.downloadLinks.map((link, idx) => (
              <div key={idx} className="bg-slate-900/70 p-3 rounded border border-slate-600">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300">{link.name}</span>
                  {editForm.downloadLinks.length>1 && <button type="button" onClick={() => handleEditRemoveDownloadLink(idx)} className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded">Remove</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Name</label>
                    <input type="text" value={link.name} onChange={(e) => handleEditUpdateDownloadLink(idx, 'name', e.target.value)} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Quality</label>
                    <input type="text" value={link.quality||''} onChange={(e) => handleEditUpdateDownloadLink(idx, 'quality', e.target.value)} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-xs text-slate-400">URL</label>
                  <input type="url" value={link.url} onChange={(e) => handleEditUpdateDownloadLink(idx, 'url', e.target.value)} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-2 text-sm" />
                </div>
                <div className="mt-2">
                  <label className="text-xs text-slate-400">Type</label>
                  <select value={link.type||'direct'} onChange={(e) => handleEditUpdateDownloadLink(idx, 'type', e.target.value)} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-2 text-sm">
                    <option>direct</option><option>server</option><option>google_drive</option><option>mega</option><option>other</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-300">Title</label>
          <input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2.5 text-sm" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={handleUpdateItem} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white font-medium py-2.5 px-4 rounded text-sm">Save Changes</button>
          <button type="button" onClick={handleCancelEdit} className="flex-1 sm:flex-none bg-slate-600 hover:bg-slate-500 text-white font-medium py-2.5 px-4 rounded text-sm flex items-center justify-center gap-1">
            <CancelIcon /> Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Deletion</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete {isManga ? 'chapter' : 'episode'} {deleteConfirm.itemNumber}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Manage {isManga ? 'Chapters' : 'Episodes'}</h2>
        <button
          onClick={handleRefresh}
          disabled={animesLoading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
        >
          {animesLoading ? <><Spinner size="sm" /> Refreshing...</> : <><RefreshIcon /> Refresh Content</>}
        </button>
      </div>

      {/* Content Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Select {isManga ? 'Manga' : 'Anime/Movie'} *
        </label>
        <SearchableDropdown<Anime>
          options={animes}
          value={selectedAnime}
          onChange={setSelectedAnime}
          placeholder="Search anime..."
        />
      </div>

      {/* Selected Content Info with Creator Badge */}
      {selectedAnime && (
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start sm:items-center gap-4">
            {(selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage) && (
              <img
                src={selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage}
                alt={selectedAnime.title}
                className="w-14 h-20 sm:w-16 sm:h-22 object-cover rounded-lg flex-shrink-0"
                style={{ height: '88px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-semibold text-white break-words">
                  Selected: {selectedAnime.title}
                </h3>
                {isMainAdmin && (
                  (!selectedAnime.createdBy || selectedAnime.createdBy === 'admin') ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25 flex items-center gap-1">
                      <CrownIcon /> Main Admin
                    </span>
                  ) : (
                    <span
                      className="text-xs px-2 py-1 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25 flex items-center gap-1"
                      title={`Created by sub-admin: ${selectedAnime.createdByUsername}`}
                    >
                      <UserIcon /> {selectedAnime.createdByUsername || 'Sub-Admin'}
                    </span>
                  )
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                <span>Type: {selectedAnime.contentType}</span>
                <span>Status: {selectedAnime.status}</span>
                <span>Total {isManga ? 'Chapters' : 'Episodes'}: {isManga ? chapters.length : episodes.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Page(s) card */}
      {selectedAnime && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
            <DownloadIcon /> Download Page(s) for this Anime
            {loadingDownloadPages && <Spinner size="sm" />}
          </h3>

          {!loadingDownloadPages && downloadPages.length === 0 && (
            <div className="text-center py-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-4">
              <DownloadIcon />
              <p className="mt-3 text-white/60">Is anime ka koi download page nahi bana hai abhi tak.</p>
            </div>
          )}

          {downloadPages.map((page: any) => {
            const publicUrl = `https://animebing.in/download/${page.slug}`;
            const downloadCount = (page.links || []).filter((l: any) => l.type === 'download').length;
            const watchCount = (page.links || []).filter((l: any) => l.type === 'watch').length;
            const episodeNumbers = (page.links || []).map((l: any) => l.episode);
            const minEp = episodeNumbers.length ? Math.min(...episodeNumbers) : null;
            const maxEp = episodeNumbers.length ? Math.max(...episodeNumbers) : null;
            const episodeRange = minEp !== null
              ? (minEp === maxEp ? `Episode ${minEp}` : `Episode ${minEp}-${maxEp}`)
              : 'No episodes';

            return (
              <div
                key={page._id}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden shadow-xl transition-all hover:shadow-2xl transform-gpu"
                style={{ willChange: 'transform' }}
              >
                <div className="relative p-4 sm:p-5 flex flex-col gap-4">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-gradient-to-b from-purple-400 to-pink-400"></div>

                  <div className="flex-1 pl-3">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-14 h-18 sm:w-20 sm:h-24 rounded-lg overflow-hidden bg-gray-800/80 shadow-lg border border-white/10">
                        {(selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage) ? (
                          <img
                            src={selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage}
                            alt={selectedAnime.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-700/50">
                            <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-white break-words">{selectedAnime.title}</h3>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="text-white/70">
                            <span className="text-purple-300 font-medium">Starting Ep:</span> {page.episodeNumber}
                          </span>
                          <span className="text-white/70">
                            <span className="text-purple-300 font-medium">Button:</span> {page.title || 'Download'}
                          </span>
                          <span className="text-white/70">
                            <span className="text-purple-300 font-medium">{episodeRange}</span>
                          </span>
                          <span className="text-white/70">
                            <span className="text-purple-300 font-medium">Total Links:</span> {(page.links || []).length}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-white/50 flex flex-wrap items-center gap-3">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                          </svg>
                          <span>Download: <span className="text-emerald-300 font-medium">{downloadCount}</span></span>
                          <span>Watch: <span className="text-blue-300 font-medium">{watchCount}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap pl-3 sm:pl-0">
                    {/* View / Test button */}
                    <button
                      onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                      title="View / test public download page"
                      className="p-2.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl text-white/80 hover:text-emerald-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>

                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(publicUrl, 'Download page link copied!')}
                      title="Copy download page link"
                      className="p-2.5 bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/50 rounded-xl text-white/80 hover:text-yellow-300 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Shorten button — main admin only */}
                    {isMainAdmin && (
                      <button
                        onClick={() => handleAutoGenerateLinks(false, publicUrl)}
                        disabled={generatingLinks}
                        title="Generate 4 short links + direct for this page"
                        className="p-2.5 bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/50 rounded-xl text-white/80 hover:text-green-300 transition-all"
                      >
                        {generatingLinks ? <Spinner size="sm" /> : <BoltIcon />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                  setEditingItemId(null);
                }}
                className={`px-4 py-2 rounded-lg transition-colors text-sm ${
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
                setEditingItemId(null);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm"
            >
              + New Session
            </button>
          </div>
        </div>
      )}

      {/* Add New Item Form */}
      {selectedAnime && (
        <form onSubmit={handleAddItem} className="bg-slate-700/50 rounded-lg p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Add New {isManga ? 'Chapter' : 'Episode'} {getAvailableSessions().length > 1 && `(Session ${selectedSession})`}
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {isManga ? 'Chapter' : 'Episode'} Number *
              </label>
              <input
                type="number"
                value={newItem.number}
                onChange={(e) => setNewItem({ ...newItem, number: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
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
                onChange={(e) => setNewItem({ ...newItem, session: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                min="1"
                required
              />
            </div>
          </div>

          {/* Main Link (Admin only) */}
          <div className="bg-slate-800/70 p-4 rounded-lg border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="block text-sm font-medium text-yellow-300"><LinkIcon /> Main Link (Admin Only - Optional)</label>
              <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">Internal Use</span>
            </div>
            <p className="text-slate-400 text-xs mb-3">This is for admin reference only. It won't be shown to users.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newItem.mainLink}
                onChange={(e) => setNewItem({ ...newItem, mainLink: e.target.value })}
                placeholder="https://example.com/original-source.mp4"
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openMainLink(newItem.mainLink)}
                  disabled={!newItem.mainLink}
                  className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => newItem.mainLink && copyToClipboard(newItem.mainLink)}
                  disabled={!newItem.mainLink}
                  className="flex-1 sm:flex-none justify-center bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy
                </button>
                {isMainAdmin && (
                  <button
                    type="button"
                    onClick={() => handleAutoGenerateLinks(false)}
                    disabled={!newItem.mainLink || generatingLinks}
                    className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
                  >
                    {generatingLinks ? <Spinner size="sm" /> : <BoltIcon />} Auto-Generate 5 Links
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Download Links */}
          <div>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <label className="block text-sm font-medium text-slate-300">User Download Links (Required) *</label>
              <button type="button" onClick={handleAddDownloadLink} disabled={newItem.downloadLinks.length >= 5} className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-2 py-1.5 rounded">
                + Add Link (Max 5)
              </button>
            </div>
            <div className="space-y-3">
              {newItem.downloadLinks.map((link, idx) => (
                <div key={idx} className="bg-slate-800/70 p-3 rounded-lg border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">{link.name}</span>
                    {newItem.downloadLinks.length > 1 && (
                      <button type="button" onClick={() => handleRemoveDownloadLink(idx)} className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Link Name *</label>
                      <input type="text" value={link.name} onChange={(e) => handleUpdateDownloadLink(idx, 'name', e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-2 text-sm" required />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Quality</label>
                      <input type="text" value={link.quality || ''} onChange={(e) => handleUpdateDownloadLink(idx, 'quality', e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-slate-400">Download URL *</label>
                    <input type="url" value={link.url} onChange={(e) => handleUpdateDownloadLink(idx, 'url', e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-2 text-sm" required />
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-slate-400">Type</label>
                    <select value={link.type || 'direct'} onChange={(e) => handleUpdateDownloadLink(idx, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-2 text-sm">
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Title (optional)</label>
            <input
              type="text"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              placeholder={`Defaults to '${isManga ? 'Chapter' : 'Episode'} X'`}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addingItem}
              className="w-full sm:w-auto justify-center bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {addingItem ? <><Spinner size="sm" /> Adding...</> : `Add ${isManga ? 'Chapter' : 'Episode'}`}
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      {selectedAnime && (
        <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-white">
              {isManga ? 'Chapters' : 'Episodes'} List {getAvailableSessions().length > 1 && `(Session ${selectedSession})`}
              ({filteredItems.length})
            </h3>
            {loading && <Spinner size="sm" />}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="md" text={`Loading...`} /></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No {isManga ? 'chapters' : 'episodes'} added yet for Session {selectedSession}.</div>
          ) : (
            <>
              {/* ============ MOBILE CARD VIEW (below lg) ============ */}
              <div className="lg:hidden space-y-3">
                {filteredItems.map((item: any) => {
                  const isEditing = editingItemId === item._id;
                  const number = isManga ? item.chapterNumber : item.episodeNumber;
                  return (
                    <div key={item._id} className={`bg-slate-700/30 rounded-lg overflow-hidden border ${isEditing ? 'border-yellow-500/50' : 'border-slate-700'}`}>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-white font-semibold">#{number}</span>
                              <span className="text-blue-400 bg-blue-600/20 px-2 py-0.5 rounded text-xs">S{item.session || 1}</span>
                            </div>
                            {item.title && <p className="text-white text-sm mt-1 break-words">{item.title}</p>}
                          </div>
                        </div>

                        {item.mainLink && (
                          <div className="mt-3">
                            <p className="text-xs text-yellow-300/70 mb-1">Main Link (Admin)</p>
                            <div className="text-xs text-yellow-300 truncate cursor-pointer" title={item.mainLink} onClick={() => copyToClipboard(item.mainLink)}>
                              {item.mainLink.substring(0, 40)}...
                            </div>
                            <div className="flex gap-2 mt-1.5">
                              <button onClick={() => openMainLink(item.mainLink)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">Open</button>
                              <button onClick={() => copyToClipboard(item.mainLink)} className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded">Copy</button>
                            </div>
                          </div>
                        )}

                        {item.downloadLinks?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-1">User Links ({item.downloadLinks.length})</p>
                            <div className="space-y-1">
                              {item.downloadLinks.slice(0, 2).map((l: any, i: number) => (
                                <div key={i} className="text-xs truncate">
                                  <span className="text-blue-400">{l.name}:</span>{' '}
                                  <a href={l.url} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300">{l.url.substring(0, 30)}...</a>
                                </div>
                              ))}
                              {item.downloadLinks.length > 2 && <div className="text-green-400 text-xs">+{item.downloadLinks.length - 2} more</div>}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleEditItem(item)} className={`flex-1 justify-center px-3 py-2 rounded text-sm transition-colors ${isEditing ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-blue-600 hover:bg-blue-500'} text-white flex items-center gap-1`}>
                            {isEditing ? <><CancelIcon /> Cancel</> : <><EditIcon /> Edit</>}
                          </button>
                          {!isEditing && (
                            <button
                              onClick={() => setDeleteConfirm({
                                itemId: item._id,
                                itemNumber: number,
                                session: item.session || 1
                              })}
                              className="flex-1 justify-center bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
                            >
                              <TrashIcon /> Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="border-t border-slate-700 p-3 bg-slate-800/70">
                          {renderEditForm(item)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ============ DESKTOP TABLE VIEW (lg and up) ============ */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full bg-slate-700/30 rounded-lg overflow-hidden">
                  <thead className="bg-slate-600/50">
                    <tr>
                      <th className="p-3 text-left text-slate-300 font-medium">#</th>
                      <th className="p-3 text-left text-slate-300 font-medium">Session</th>
                      <th className="p-3 text-left text-slate-300 font-medium">Title</th>
                      <th className="p-3 text-left text-slate-300 font-medium">Main Link (Admin)</th>
                      <th className="p-3 text-left text-slate-300 font-medium">User Links</th>
                      <th className="p-3 text-left text-slate-300 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredItems.map((item: any) => {
                      const isEditing = editingItemId === item._id;
                      return (
                        <React.Fragment key={item._id}>
                          <tr className={`hover:bg-slate-600/30 transition-colors ${isEditing ? 'bg-slate-700/50' : ''}`}>
                            <td className="p-3 font-mono">{isManga ? item.chapterNumber : item.episodeNumber}</td>
                            <td className="p-3"><span className="text-blue-400 bg-blue-600/20 px-2 py-1 rounded text-xs">S{item.session || 1}</span></td>
                            <td className="p-3 text-white">{item.title}</td>
                            <td className="p-3">
                              {item.mainLink ? (
                                <div className="space-y-2">
                                  <div className="text-xs text-yellow-300 truncate max-w-xs cursor-pointer" title={item.mainLink} onClick={() => copyToClipboard(item.mainLink)}>
                                    {item.mainLink.substring(0, 30)}...
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => openMainLink(item.mainLink)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">Open</button>
                                    <button onClick={() => copyToClipboard(item.mainLink)} className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded">Copy</button>
                                  </div>
                                </div>
                              ) : <span className="text-slate-500 text-xs italic">None</span>}
                            </td>
                            <td className="p-3">
                              {item.downloadLinks?.length ? (
                                <div className="space-y-1">
                                  {item.downloadLinks.slice(0,2).map((l: any, i: number) => (
                                    <div key={i} className="text-xs"><span className="text-blue-400">{l.name}:</span> <a href={l.url} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 truncate block max-w-xs">{l.url.substring(0,30)}...</a></div>
                                  ))}
                                  {item.downloadLinks.length > 2 && <div className="text-green-400 text-xs">+{item.downloadLinks.length-2} more</div>}
                                </div>
                              ) : <span className="text-slate-500 text-sm">None</span>}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <button onClick={() => handleEditItem(item)} className={`px-3 py-1 rounded text-sm transition-colors ${isEditing ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-blue-600 hover:bg-blue-500'} text-white flex items-center gap-1`}>
                                  {isEditing ? <><CancelIcon /> Cancel</> : <><EditIcon /> Edit</>}
                                </button>
                                {!isEditing && (
                                  <button
                                    onClick={() => setDeleteConfirm({
                                      itemId: item._id,
                                      itemNumber: isManga ? item.chapterNumber : item.episodeNumber,
                                      session: item.session || 1
                                    })}
                                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                                  >
                                    <TrashIcon /> Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr className="bg-slate-800/70 border-b border-slate-700">
                              <td colSpan={6} className="p-4">
                                {renderEditForm(item)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EpisodesManager;