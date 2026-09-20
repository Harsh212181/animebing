 // src/components/admin/EpisodesManager.tsx - Premium UI, no emojis, custom SVG icons
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

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  link:      'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  crown:     'M5 16l2-8 5 4 5-4 2 8H5z M3 20h18',
  user:      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  download:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  cancel:    'M6 18L18 6M6 6l12 12',
  edit:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  bolt:      'M13 10V3L4 14h7v7l9-11h-7z',
  plus:      'M12 4v16m8-8H4',
  open:      'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  copy:      'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  eye:       'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  warning:   'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  check:     'M5 13l4 4L19 7',
  chevron:   'M19 9l-7 7-7-7',
};

// ── Confirm Modal ─────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            danger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <SvgIcon d={ICONS.warning} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const EpisodesManager: React.FC<EpisodesManagerProps> = ({ token: tokenProp, isMainAdmin = false }) => {
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const restrictLinks = !isMainAdmin;
  const [genToken, setGenToken] = useState('');

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
      setGenToken('');
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
      setGenToken('');
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setGenToken('');
  };

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
      toast.error('Pehle valid link daalo');
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

      if (newLinks.some(l => !l.url)) {
        toast.error('Kuch shortener fail ho gaye, dobara generate karo');
        return;
      }

      setGenToken(data.genToken || '');
      if (isEdit && !externalLink) {
        setEditForm(prev => ({ ...prev, mainLink: link, downloadLinks: newLinks }));
      } else {
        setNewItem(prev => ({ ...prev, mainLink: link, downloadLinks: newLinks }));
      }
      toast.success('4 short links + 1 direct link form me add ho gaye!');
    } catch (err: any) {
      console.error('Auto-generate error:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || 'Link generate karne me error aaya');
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

    if (restrictLinks && (!genToken || newItem.downloadLinks.length !== 5)) {
      toast.error('Pehle download page ke ⚡ button se saare 5 links Auto-Generate karo');
      return;
    }

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
            downloadLinks: newItem.downloadLinks,
            ...(genToken ? { genToken } : {})
          }
        : {
            animeId: selectedAnime._id,
            episodeNumber: newItem.number,
            title: newItem.title || `Episode ${newItem.number}`,
            session: newItem.session,
            mainLink: newItem.mainLink,
            downloadLinks: newItem.downloadLinks,
            ...(genToken ? { genToken } : {})
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
      setGenToken('');
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
            downloadLinks: editForm.downloadLinks,
            ...(genToken ? { genToken } : {})
          }
        : {
            animeId: selectedAnime._id,
            episodeNumber: editForm.number,
            title: editForm.title || `Episode ${editForm.number}`,
            session: editForm.session,
            mainLink: editForm.mainLink,
            downloadLinks: editForm.downloadLinks,
            ...(genToken ? { genToken } : {})
          };

      await axios.patch(`${API_BASE}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      toast.success(`${isManga ? 'Chapter' : 'Episode'} updated successfully!`);
      setEditingItemId(null);
      setGenToken('');
      await fetchContent(selectedAnime._id);
    } catch (err: any) {
      console.error('Update error:', err.response?.data || err.message);
      toast.error(`Failed to update ${isManga ? 'chapter' : 'episode'}: ${err.response?.data?.error || err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !selectedAnime) return;
    const { itemNumber, session } = deleteConfirm;
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

  // ── Shared input style classes ──────────────────────────────────────
  const inputCls = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20";

  // ── Shared edit form ────────────────────────────────────────────────
  const renderEditForm = (_item: any) => (
    <div className="border-l-2 border-amber-400 pl-4 py-1 space-y-4">
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300">
          <SvgIcon d={ICONS.edit} className="w-3.5 h-3.5" />
        </span>
        <h4 className="text-sm font-bold text-white">
          Edit {isManga ? 'Chapter' : 'Episode'} #{editForm.number}
        </h4>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Number *</label>
            <input type="number" value={editForm.number} onChange={(e) => setEditForm({...editForm, number: Math.max(1, parseInt(e.target.value)||1)})} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Session *</label>
            <input type="number" value={editForm.session} onChange={(e) => setEditForm({...editForm, session: Math.max(1, parseInt(e.target.value)||1)})} className={inputCls} />
          </div>
        </div>

        {/* Main link (admin) */}
        <div className="p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-amber-300" />
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Main Link (Admin)</label>
          </div>
          <input type="text" value={editForm.mainLink} onChange={(e) => setEditForm({...editForm, mainLink: e.target.value})} className={inputCls} />
          {isMainAdmin && (
            <button
              type="button"
              onClick={() => handleAutoGenerateLinks(true)}
              disabled={!editForm.mainLink || generatingLinks}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-lg transition-all"
            >
              {generatingLinks ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SvgIcon d={ICONS.bolt} className="w-3 h-3" />}
              Auto-Generate 5 Links
            </button>
          )}
        </div>

        {/* Download links */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">User Download Links</label>
            <button type="button" onClick={handleEditAddDownloadLink} disabled={editForm.downloadLinks.length>=5}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <SvgIcon d={ICONS.plus} className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {editForm.downloadLinks.map((link, idx) => (
              <div key={idx} className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-300">{link.name}</span>
                  {editForm.downloadLinks.length>1 && (
                    <button type="button" onClick={() => handleEditRemoveDownloadLink(idx)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/25 transition-all">
                      Remove
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Name</label>
                  <input type="text" value={link.name} onChange={(e) => handleEditUpdateDownloadLink(idx, 'name', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">URL</label>
                  <input type="url" value={link.url} onChange={(e) => handleEditUpdateDownloadLink(idx, 'url', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
                  <select value={link.type||'direct'} onChange={(e) => handleEditUpdateDownloadLink(idx, 'type', e.target.value)} className={inputCls}>
                    <option className="bg-slate-900">direct</option>
                    <option className="bg-slate-900">server</option>
                    <option className="bg-slate-900">google_drive</option>
                    <option className="bg-slate-900">mega</option>
                    <option className="bg-slate-900">other</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Title</label>
          <input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} className={inputCls} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={handleUpdateItem}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all">
            <SvgIcon d={ICONS.check} className="w-3.5 h-3.5" /> Save Changes
          </button>
          <button type="button" onClick={handleCancelEdit}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 text-xs font-bold rounded-lg transition-all">
            <SvgIcon d={ICONS.cancel} className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        title={`Delete ${isManga ? 'Chapter' : 'Episode'}?`}
        message={`Are you sure you want to delete ${isManga ? 'chapter' : 'episode'} ${deleteConfirm?.itemNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20">
            <SvgIcon d={ICONS.download} className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Manage {isManga ? 'Chapters' : 'Episodes'}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isManga ? 'Chapters' : 'Episodes'} aur download links manage karo
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={animesLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] disabled:opacity-50 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition-all"
        >
          {animesLoading
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Refreshing...</>
            : <><SvgIcon d={ICONS.refresh} className="w-3.5 h-3.5" /> Refresh</>}
        </button>
      </div>

      {/* ─── Content Selection ─────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          <SvgIcon d={ICONS.eye} className="w-3 h-3" />
          Select {isManga ? 'Manga' : 'Anime/Movie'} *
        </label>
        <SearchableDropdown<Anime>
          options={animes}
          value={selectedAnime}
          onChange={setSelectedAnime}
          placeholder="Search anime..."
        />
      </div>

      {/* ─── Selected Content Info ────────────────────── */}
      {selectedAnime && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-start gap-3">
            {(selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage) && (
              <img
                src={selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage}
                alt={selectedAnime.title}
                className="w-12 h-16 object-cover rounded-lg flex-shrink-0 border border-white/10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-white break-words">
                  {selectedAnime.title}
                </h3>
                {isMainAdmin && (
                  (!selectedAnime.createdBy || selectedAnime.createdBy === 'admin') ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                      <SvgIcon d={ICONS.crown} className="w-2.5 h-2.5" /> Admin
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25"
                      title={`Created by sub-admin: ${selectedAnime.createdByUsername}`}
                    >
                      <SvgIcon d={ICONS.user} className="w-2.5 h-2.5" /> {selectedAnime.createdByUsername || 'Sub-Admin'}
                    </span>
                  )
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                <span>Type: <span className="text-white/70">{selectedAnime.contentType}</span></span>
                <span>Status: <span className="text-white/70">{selectedAnime.status}</span></span>
                <span>Total: <span className="text-purple-300 font-bold">{isManga ? chapters.length : episodes.length}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Download Pages ──────────────────────────── */}
      {selectedAnime && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-400 rounded-full" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <SvgIcon d={ICONS.download} className="w-3.5 h-3.5 text-purple-300" />
              Download Pages
            </h3>
            {loadingDownloadPages && <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />}
          </div>

          {!loadingDownloadPages && downloadPages.length === 0 && (
            <div className="text-center py-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <SvgIcon d={ICONS.download} className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-xs text-gray-400 font-medium">No download page yet</p>
              <p className="text-[10px] text-gray-600 mt-1">Is anime ka abhi tak koi download page nahi bana</p>
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
              ? (minEp === maxEp ? `Ep ${minEp}` : `Ep ${minEp}-${maxEp}`)
              : 'No episodes';

            return (
              <div
                key={page._id}
                className="relative bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl overflow-hidden transition-all"
              >
                <span className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-purple-400 to-pink-400 rounded-r-full" />

                <div className="p-4 pl-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.08]">
                      {(selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage) ? (
                        <img
                          src={selectedAnime.thumbnail || selectedAnime.posterImage || selectedAnime.coverImage}
                          alt={selectedAnime.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <SvgIcon d={ICONS.download} className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{selectedAnime.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-gray-400">Start Ep: <span className="text-purple-300 font-bold">{page.episodeNumber}</span></span>
                        <span className="text-gray-400">Button: <span className="text-purple-300 font-semibold">{page.title || 'Download'}</span></span>
                        <span className="text-gray-400"><span className="text-purple-300 font-bold">{episodeRange}</span></span>
                        <span className="text-gray-400">Links: <span className="text-purple-300 font-bold">{(page.links || []).length}</span></span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Download: <span className="font-bold">{downloadCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          Watch: <span className="font-bold">{watchCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                      title="View public page"
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 transition-all"
                    >
                      <SvgIcon d={ICONS.eye} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(publicUrl, 'Download page link copied!')}
                      title="Copy link"
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-amber-500/10 hover:border-amber-500/25 hover:text-amber-300 transition-all"
                    >
                      <SvgIcon d={ICONS.copy} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleAutoGenerateLinks(false, publicUrl)}
                      disabled={generatingLinks}
                      title="Auto-generate 5 links"
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 disabled:opacity-40 transition-all"
                    >
                      {generatingLinks
                        ? <span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                        : <SvgIcon d={ICONS.bolt} className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Session Selector ───────────────────────── */}
      {selectedAnime && getAvailableSessions().length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            <SvgIcon d={ICONS.calendar} className="w-3 h-3" />
            Session
          </label>
          <div className="flex flex-wrap gap-1.5">
            {getAvailableSessions().map(session => (
              <button
                key={session}
                onClick={() => {
                  setSelectedSession(session);
                  setNewItem(prev => ({ ...prev, session }));
                  setEditingItemId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  selectedSession === session
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
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
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-lg text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
            >
              <SvgIcon d={ICONS.plus} className="w-3 h-3" /> New
            </button>
          </div>
        </div>
      )}

      {/* ─── Add New Item Form ──────────────────────── */}
      {selectedAnime && (
        <form onSubmit={handleAddItem} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-400 rounded-full" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Add New {isManga ? 'Chapter' : 'Episode'}
              {getAvailableSessions().length > 1 && <span className="text-purple-300 ml-1.5">· S{selectedSession}</span>}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
                {isManga ? 'Chapter' : 'Episode'} Number *
              </label>
              <input
                type="number"
                value={newItem.number}
                onChange={(e) => setNewItem({ ...newItem, number: Math.max(1, parseInt(e.target.value) || 1) })}
                className={inputCls}
                min="1"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Session *</label>
              <input
                type="number"
                value={newItem.session}
                onChange={(e) => setNewItem({ ...newItem, session: Math.max(1, parseInt(e.target.value) || 1) })}
                className={inputCls}
                min="1"
                required
              />
            </div>
          </div>

          {/* Main link */}
          <div className="p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <SvgIcon d={ICONS.link} className="w-3.5 h-3.5 text-amber-300" />
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Main Link (Admin Only)</label>
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
                Internal
              </span>
            </div>
            <p className="text-[10px] text-gray-500">Only visible to admins, not shown to users</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newItem.mainLink}
                onChange={(e) => setNewItem({ ...newItem, mainLink: e.target.value })}
                placeholder="https://example.com/original.mp4"
                className={`${inputCls} flex-1`}
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => openMainLink(newItem.mainLink)}
                  disabled={!newItem.mainLink}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/25 text-sky-300 text-[11px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <SvgIcon d={ICONS.open} className="w-3 h-3" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => newItem.mainLink && copyToClipboard(newItem.mainLink)}
                  disabled={!newItem.mainLink}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 text-[11px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <SvgIcon d={ICONS.copy} className="w-3 h-3" /> Copy
                </button>
                {isMainAdmin && (
                  <button
                    type="button"
                    onClick={() => handleAutoGenerateLinks(false)}
                    disabled={!newItem.mainLink || generatingLinks}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {generatingLinks ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SvgIcon d={ICONS.bolt} className="w-3 h-3" />}
                    Auto-Generate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Download links */}
          <div>
            {restrictLinks && (
              <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2 mb-2">
                <SvgIcon d={ICONS.warning} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Links manually add nahi kar sakte — upar Download Page card ke ⚡ button se generate karo</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <SvgIcon d={ICONS.download} className="w-3 h-3" />
                User Download Links *
              </label>
              {!restrictLinks && (
                <button
                  type="button"
                  onClick={handleAddDownloadLink}
                  disabled={newItem.downloadLinks.length >= 5}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <SvgIcon d={ICONS.plus} className="w-3 h-3" /> Add (max 5)
                </button>
              )}
            </div>
            <div className="space-y-2">
              {newItem.downloadLinks.map((link, idx) => (
                <div key={idx} className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-300">{link.name}</span>
                    {!restrictLinks && newItem.downloadLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDownloadLink(idx)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/25 transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Link Name *</label>
                    <input type="text" value={link.name} onChange={(e) => handleUpdateDownloadLink(idx, 'name', e.target.value)} readOnly={restrictLinks} className={`${inputCls} ${restrictLinks ? 'opacity-60' : ''}`} required />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Download URL *</label>
                    <input type="url" value={link.url} onChange={(e) => handleUpdateDownloadLink(idx, 'url', e.target.value)} readOnly={restrictLinks} className={`${inputCls} ${restrictLinks ? 'opacity-60' : ''}`} required />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
                    <select value={link.type || 'direct'} onChange={(e) => handleUpdateDownloadLink(idx, 'type', e.target.value)} disabled={restrictLinks} className={`${inputCls} ${restrictLinks ? 'opacity-60' : ''}`}>
                      <option value="direct" className="bg-slate-900">Direct Download</option>
                      <option value="server" className="bg-slate-900">Server Download</option>
                      <option value="google_drive" className="bg-slate-900">Google Drive</option>
                      <option value="mega" className="bg-slate-900">Mega.nz</option>
                      <option value="other" className="bg-slate-900">Other</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Title (optional)</label>
            <input
              type="text"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              placeholder={`Defaults to '${isManga ? 'Chapter' : 'Episode'} X'`}
              className={inputCls}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={addingItem || (restrictLinks && !genToken)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {addingItem
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</>
                : <><SvgIcon d={ICONS.plus} className="w-3.5 h-3.5" /> Add {isManga ? 'Chapter' : 'Episode'}</>}
            </button>
          </div>
        </form>
      )}

      {/* ─── Items List ─────────────────────────────── */}
      {selectedAnime && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-400 rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                {isManga ? 'Chapters' : 'Episodes'} List
                {getAvailableSessions().length > 1 && <span className="text-purple-300 ml-1.5">· S{selectedSession}</span>}
              </h3>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 rounded-md">
                {filteredItems.length}
              </span>
            </div>
            {loading && <span className="w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="md" text={`Loading...`} /></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <SvgIcon d={ICONS.download} className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-xs text-gray-400 font-medium">
                No {isManga ? 'chapters' : 'episodes'} in Session {selectedSession}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Use the form above to add content</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="lg:hidden space-y-2">
                {filteredItems.map((item: any) => {
                  const isEditing = editingItemId === item._id;
                  const number = isManga ? item.chapterNumber : item.episodeNumber;
                  return (
                    <div key={item._id} className={`bg-white/[0.02] rounded-xl overflow-hidden border transition-all ${isEditing ? 'border-amber-500/40 bg-amber-500/[0.03]' : 'border-white/[0.06]'}`}>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-white font-bold text-sm">#{number}</span>
                              <span className="text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                S{item.session || 1}
                              </span>
                            </div>
                            {item.title && <p className="text-white/80 text-xs mt-1 break-words">{item.title}</p>}
                          </div>
                        </div>

                        {item.mainLink && (
                          <div className="mt-2">
                            <p className="text-[10px] text-amber-300/70 uppercase tracking-wide font-semibold mb-0.5">Main Link</p>
                            <div className="text-[10px] text-amber-300 truncate cursor-pointer font-mono" title={item.mainLink} onClick={() => copyToClipboard(item.mainLink)}>
                              {item.mainLink.substring(0, 40)}...
                            </div>
                            <div className="flex gap-1.5 mt-1.5">
                              <button onClick={() => openMainLink(item.mainLink)} className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">Open</button>
                              <button onClick={() => copyToClipboard(item.mainLink)} className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">Copy</button>
                            </div>
                          </div>
                        )}

                        {item.downloadLinks?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">User Links ({item.downloadLinks.length})</p>
                            <div className="space-y-0.5">
                              {item.downloadLinks.slice(0, 2).map((l: any, i: number) => (
                                <div key={i} className="text-[10px] truncate">
                                  <span className="text-purple-300 font-semibold">{l.name}:</span>{' '}
                                  <a href={l.url} target="_blank" rel="noopener" className="text-sky-300 hover:text-sky-200 font-mono">{l.url.substring(0, 30)}...</a>
                                </div>
                              ))}
                              {item.downloadLinks.length > 2 && <div className="text-emerald-300 text-[10px] font-bold">+{item.downloadLinks.length - 2} more</div>}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-1.5 mt-3">
                          <button
                            onClick={() => handleEditItem(item)}
                            className={`flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                              isEditing
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/25 hover:bg-amber-500/25'
                                : 'bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/25'
                            }`}
                          >
                            {isEditing ? <><SvgIcon d={ICONS.cancel} className="w-3 h-3" /> Cancel</> : <><SvgIcon d={ICONS.edit} className="w-3 h-3" /> Edit</>}
                          </button>
                          {!isEditing && (
                            <button
                              onClick={() => setDeleteConfirm({ itemId: item._id, itemNumber: number, session: item.session || 1 })}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/25 text-[11px] font-bold hover:bg-rose-500/25 transition-all"
                            >
                              <SvgIcon d={ICONS.trash} className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="border-t border-amber-500/20 p-3 bg-amber-500/[0.02]">
                          {renderEditForm(item)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">#</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Session</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Title</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Main Link</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">User Links</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: any) => {
                      const isEditing = editingItemId === item._id;
                      return (
                        <React.Fragment key={item._id}>
                          <tr className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${isEditing ? 'bg-amber-500/[0.03]' : ''}`}>
                            <td className="p-2.5 font-mono text-white font-bold">{isManga ? item.chapterNumber : item.episodeNumber}</td>
                            <td className="p-2.5">
                              <span className="text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                S{item.session || 1}
                              </span>
                            </td>
                            <td className="p-2.5 text-white/85">{item.title}</td>
                            <td className="p-2.5">
                              {item.mainLink ? (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono text-amber-300 truncate max-w-[180px] cursor-pointer" title={item.mainLink} onClick={() => copyToClipboard(item.mainLink)}>
                                    {item.mainLink.substring(0, 25)}...
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => openMainLink(item.mainLink)} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">Open</button>
                                    <button onClick={() => copyToClipboard(item.mainLink)} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">Copy</button>
                                  </div>
                                </div>
                              ) : <span className="text-gray-600 text-[10px] italic">None</span>}
                            </td>
                            <td className="p-2.5">
                              {item.downloadLinks?.length ? (
                                <div className="space-y-0.5">
                                  {item.downloadLinks.slice(0,2).map((l: any, i: number) => (
                                    <div key={i} className="text-[10px]">
                                      <span className="text-purple-300 font-semibold">{l.name}:</span>{' '}
                                      <a href={l.url} target="_blank" rel="noopener" className="text-sky-300 hover:text-sky-200 truncate inline-block max-w-[140px] font-mono align-bottom">{l.url.substring(0,20)}...</a>
                                    </div>
                                  ))}
                                  {item.downloadLinks.length > 2 && <div className="text-emerald-300 text-[10px] font-bold">+{item.downloadLinks.length-2} more</div>}
                                </div>
                              ) : <span className="text-gray-600 text-[10px]">None</span>}
                            </td>
                            <td className="p-2.5">
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                                    isEditing
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/25 hover:bg-amber-500/25'
                                      : 'bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/25'
                                  }`}
                                >
                                  {isEditing ? <><SvgIcon d={ICONS.cancel} className="w-3 h-3" /> Cancel</> : <><SvgIcon d={ICONS.edit} className="w-3 h-3" /> Edit</>}
                                </button>
                                {!isEditing && (
                                  <button
                                    onClick={() => setDeleteConfirm({ itemId: item._id, itemNumber: isManga ? item.chapterNumber : item.episodeNumber, session: item.session || 1 })}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 text-[10px] font-bold hover:bg-rose-500/25 transition-all"
                                  >
                                    <SvgIcon d={ICONS.trash} className="w-3 h-3" /> Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr className="bg-amber-500/[0.02] border-b border-white/[0.06]">
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