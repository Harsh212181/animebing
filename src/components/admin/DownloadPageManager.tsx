 import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DownloadPage, DownloadPageLink, ContentType, SubDubStatus } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import Spinner from '../Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 
  'https://animabing-backend.animabingwatch.workers.dev/api';

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

// Hidden status now mirrors the ANIME's hidden state (set from Anime List Manager),
// not a separate per-page control. This is display-only in this component.
const isAnimeHidden = (page: DownloadPage): boolean => {
  if (page.animeId && typeof page.animeId === 'object') {
    return !!(page.animeId as any).isHidden;
  }
  return false;
};

// ----- Toast Component -----
interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

const Toast: React.FC<{ toast: ToastState; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, onClose]);

  if (!toast.visible) return null;

  const bgColor = {
    success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200',
    error: 'bg-rose-500/20 border-rose-500/50 text-rose-200',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-200',
  }[toast.type];

  const icon = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }[toast.type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${bgColor}`}>
        {icon}
        <span className="text-sm font-medium">{toast.message}</span>
        <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ----- Confirm Modal Component -----
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/70 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-medium transition shadow-lg shadow-rose-600/20"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Main Component -----
const DownloadPageManager: React.FC = () => {
  const [pages, setPages] = useState<DownloadPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<FormPage | null>(null);
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [animeThumbnails, setAnimeThumbnails] = useState<Map<string, string>>(new Map());
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [calculatingNext, setCalculatingNext] = useState(false);

  // 🔧 FIX: tracks how many download/watch links already EXISTED (were saved)
  // when the current editing session started. Used so that when adding new
  // links we only offset by NEW additions in this session, not by links
  // that the server-calculated "next episode" has already accounted for.
  const initialLinkCountsRef = useRef<{ download: number; watch: number }>({ download: 0, watch: 0 });

  // Toast state
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };
  const closeToast = () => setToast(prev => ({ ...prev, visible: false }));

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({ show: false, id: null });

  // Filter states
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | ContentType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'complete'>('all');
  const [subDubFilter, setSubDubFilter] = useState<'all' | string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

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
        
        // Build thumbnail map
        const map = new Map<string, string>();
        animeArray.forEach((a: any) => {
          let thumb = a.thumbnail || a.image || a.poster || a.cover;
          if (thumb && !thumb.startsWith('http')) {
            thumb = `${API_BASE}${thumb.startsWith('/') ? '' : '/'}${thumb}`;
          }
          if (thumb) map.set(a._id, thumb);
        });
        setAnimeThumbnails(map);
      } else {
        console.error('Expected array but got:', json);
        setAnimeOptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch anime:', error);
      setAnimeOptions([]);
    }
  };

  // Fetch all pages for a given anime and return the highest episode number found
  const getNextStartingEpisode = async (animeId: string): Promise<number> => {
    if (!animeId) return 1;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/download-pages/anime/${animeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) return 1;
      const animePages = await res.json();
      if (!Array.isArray(animePages)) return 1;

      let maxEpisode = 0;
      animePages.forEach((page: DownloadPage) => {
        page.links.forEach(link => {
          if (link.episode > maxEpisode) maxEpisode = link.episode;
        });
      });
      return maxEpisode + 1;
    } catch (error) {
      console.error('Failed to fetch pages for anime:', error);
      return 1;
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

  // Helper to get full anime details with fallback thumbnail from map
  const getAnimeDetails = (page: DownloadPage): { 
    title: string; 
    contentType?: ContentType; 
    subDubStatus?: SubDubStatus;
    status?: string;
    thumbnail?: string;
    animeId: string;
    isHidden?: boolean;
  } => {
    if (page.animeId && typeof page.animeId === 'object') {
      const animeObj = page.animeId as any;
      let thumbnail = animeObj.thumbnail || animeObj.image || animeObj.poster || animeObj.cover;
      
      // If thumbnail not found in nested object, try the map
      if (!thumbnail && animeObj._id) {
        thumbnail = animeThumbnails.get(animeObj._id);
      }
      
      // Make URL absolute if relative
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${API_BASE}${thumbnail.startsWith('/') ? '' : '/'}${thumbnail}`;
      }
      
      return {
        title: animeObj.title || 'Unknown Anime',
        contentType: animeObj.contentType,
        subDubStatus: animeObj.subDubStatus,
        status: animeObj.status,
        thumbnail: thumbnail,
        animeId: animeObj._id,
        isHidden: !!animeObj.isHidden
      };
    }
    return { title: 'Unknown Anime', animeId: typeof page.animeId === 'string' ? page.animeId : '' };
  };

  // Handle anime selection for new page creation (auto-calculates next episode)
  const handleNewAnimeChange = async (option: AnimeOption | null) => {
    const animeId = option?._id || '';
    if (!animeId) {
      setEditingPage(prev => prev ? { ...prev, animeId: '' } : null);
      return;
    }
    setCalculatingNext(true);
    const next = await getNextStartingEpisode(animeId);
    setEditingPage(prev => {
      if (!prev) return null;
      return { ...prev, animeId, episodeNumber: next };
    });
    setCalculatingNext(false);
  };

  // Handle anime selection for editing (does not change episode number)
  const handleEditAnimeChange = (option: AnimeOption | null) => {
    const animeId = option?._id || '';
    setEditingPage(prev => prev ? { ...prev, animeId } : null);
  };

  const handleSave = async (pageToSave: FormPage) => {
    if (!pageToSave.animeId) {
      showToast('Please select an anime', 'error');
      return;
    }
    if (!pageToSave.slug) {
      showToast('Please enter a slug (e.g., naruto-eps-1-10)', 'error');
      return;
    }
    if (!pageToSave.episodeNumber || pageToSave.episodeNumber < 1) {
      showToast('Please enter a valid episode number (minimum 1)', 'error');
      return;
    }
    if (!pageToSave.links || pageToSave.links.length === 0) {
      showToast('Please add at least one link', 'error');
      return;
    }

    // ✅ No cap on link count anymore — watch/download links are unlimited

    const method = pageToSave._id ? 'PUT' : 'POST';
    const url = pageToSave._id
      ? `${API_BASE}/download-pages/${pageToSave._id}`
      : `${API_BASE}/download-pages`;

    try {
      const token = getToken();
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(pageToSave),
      });
      if (res.ok) {
        fetchPages();
        setEditingPage(null);
        setShowNewForm(false);
        showToast(pageToSave._id ? 'Page updated successfully!' : 'Page created successfully!', 'success');
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast(err.error || 'Save failed', 'error');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Network error. Check console.', 'error');
    }
  };

  const requestDelete = (id: string) => {
    setDeleteConfirm({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/download-pages/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        fetchPages();
        showToast('Page deleted successfully', 'success');
      } else {
        showToast('Delete failed', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Network error while deleting', 'error');
    } finally {
      setDeleteConfirm({ show: false, id: null });
    }
  };

  // NOTE: hide/unhide control removed from here. Visibility is now shown
  // read-only, mirrored from the anime's own `isHidden` status which is
  // controlled from Anime List Manager.

  // addDownloadLink – uses global next episode
  // 🔧 FIX: offset now only counts links added DURING this editing session
  // (prev.links count minus how many already existed when editing started),
  // instead of counting every existing download link — which double-counted
  // episodes the server's "next episode" number already included.
  const addDownloadLink = async () => {
    if (!editingPage || !editingPage.animeId) return;
    setCalculatingNext(true);
    const baseEpisode = await getNextStartingEpisode(editingPage.animeId);
    setEditingPage(prev => {
      if (!prev) return null;
      const downloadCount = prev.links.filter(l => l.type === 'download').length;
      const newInSessionCount = Math.max(0, downloadCount - initialLinkCountsRef.current.download);
      const newLink: DownloadPageLink = {
        episode: baseEpisode + newInSessionCount,
        url: '',
        type: 'download',
        quality: '',
        language: ''
      };
      return { ...prev, links: [...prev.links, newLink] };
    });
    setCalculatingNext(false);
  };

  // addWatchLink – uses global next episode
  // 🔧 FIX: same session-offset logic as addDownloadLink above.
  const addWatchLink = async () => {
    if (!editingPage || !editingPage.animeId) return;
    setCalculatingNext(true);
    const baseEpisode = await getNextStartingEpisode(editingPage.animeId);
    setEditingPage(prev => {
      if (!prev) return null;
      const watchCount = prev.links.filter(l => l.type === 'watch').length;
      const newInSessionCount = Math.max(0, watchCount - initialLinkCountsRef.current.watch);
      const newLink: DownloadPageLink = {
        episode: baseEpisode + newInSessionCount,
        url: '',
        type: 'watch',
        quality: '',
        language: ''
      };
      return { ...prev, links: [...prev.links, newLink] };
    });
    setCalculatingNext(false);
  };

  // addBothLinks – adds one download and one watch link together
  // 🔧 FIX: same session-offset logic applied to both link types.
  const addBothLinks = async () => {
    if (!editingPage || !editingPage.animeId) return;
    setCalculatingNext(true);
    const baseEpisode = await getNextStartingEpisode(editingPage.animeId);
    setEditingPage(prev => {
      if (!prev) return null;
      const downloadCount = prev.links.filter(l => l.type === 'download').length;
      const watchCount = prev.links.filter(l => l.type === 'watch').length;
      const newDownloadInSession = Math.max(0, downloadCount - initialLinkCountsRef.current.download);
      const newWatchInSession = Math.max(0, watchCount - initialLinkCountsRef.current.watch);

      const newDownloadLink: DownloadPageLink = {
        episode: baseEpisode + newDownloadInSession,
        url: '',
        type: 'download',
        quality: '',
        language: ''
      };
      const newWatchLink: DownloadPageLink = {
        episode: baseEpisode + newWatchInSession,
        url: '',
        type: 'watch',
        quality: '',
        language: ''
      };
      return { ...prev, links: [...prev.links, newDownloadLink, newWatchLink] };
    });
    setCalculatingNext(false);
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

  // Compute page order for each anime based on creation time (_id)
  const pagesByAnime = useMemo(() => {
    const map = new Map<string, DownloadPage[]>();
    pages.forEach(page => {
      const animeId = getAnimeDetails(page).animeId;
      if (!animeId) return;
      if (!map.has(animeId)) map.set(animeId, []);
      map.get(animeId)!.push(page);
    });
    // Sort each anime's pages by _id ascending (oldest first) -> Page 1, Page 2, Page 3...
    map.forEach((list) => {
      list.sort((a, b) => a._id.localeCompare(b._id));
    });
    return map;
  }, [pages]);

  // Filter pages based on search, contentType, status, sub/dub status, and visibility
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const animeTitle = getAnimeTitle(page).toLowerCase();
      const term = searchTerm.toLowerCase();
      if (!animeTitle.includes(term)) return false;

      const details = getAnimeDetails(page);
      if (contentTypeFilter !== 'all' && details.contentType !== contentTypeFilter) return false;
      if (statusFilter !== 'all') {
        const animeStatus = details.status?.toLowerCase();
        if (statusFilter === 'ongoing' && animeStatus !== 'ongoing') return false;
        if (statusFilter === 'complete' && animeStatus !== 'complete') return false;
      }
      // Sub/Dub filter
      if (subDubFilter !== 'all') {
        const subDub = details.subDubStatus;
        if (subDub !== subDubFilter) return false;
      }
      // Visibility filter (mirrors the ANIME's hidden status)
      if (visibilityFilter === 'visible' && details.isHidden) return false;
      if (visibilityFilter === 'hidden' && !details.isHidden) return false;
      return true;
    });
  }, [pages, searchTerm, contentTypeFilter, statusFilter, subDubFilter, visibilityFilter]);

  // Final display order:
  // - Anime groups sorted by their latest page's _id (newest anime group with recent activity on top)
  // - Within each anime, pages keep their natural order (oldest page first) so
  //   "Page 1 / Page 2 / Page 3" labels stay correct.
  const sortedPages = useMemo(() => {
    const groups = new Map<string, DownloadPage[]>();
    filteredPages.forEach(page => {
      const animeId = getAnimeDetails(page).animeId;
      if (!groups.has(animeId)) groups.set(animeId, []);
      groups.get(animeId)!.push(page);
    });
    // Pages within each anime sorted oldest -> newest, so "Page 1, Page 2..." numbering stays correct
    groups.forEach(list => list.sort((a, b) => a._id.localeCompare(b._id)));

    const groupEntries = Array.from(groups.entries());
    // 🔧 FIX: anime GROUPS ab unke sabse latest (naye) page ke hisaab se
    // order hote hain, anime ki apni creation date se nahi. Isse jis anime
    // mein abhi-abhi naya page add hua ho, wo list ke top pe aa jaati hai —
    // lekin har group ke andar page numbering (Page 1/2/3) hamesha
    // chronological hi rehti hai.
    groupEntries.sort((a, b) => {
      const aLatestPageId = a[1][a[1].length - 1]._id; // list ascending hai, to last = newest page
      const bLatestPageId = b[1][b[1].length - 1]._id;
      return bLatestPageId.localeCompare(aLatestPageId);
    });

    return groupEntries.flatMap(([, list]) => list);
  }, [filteredPages]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Spinner size="lg" text="Loading download pages..." />
    </div>
  );

  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Toast and Modal */}
      <Toast toast={toast} onClose={closeToast} />
      <ConfirmModal
        open={deleteConfirm.show}
        title="Delete Page"
        message="Are you sure you want to delete this download page? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
      />

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

      {/* New Page Button and Form */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
            Create New Download Page
          </h2>
          <button
            onClick={() => {
              if (showNewForm && editingPage && !editingPage._id) {
                setShowNewForm(false);
                setEditingPage(null);
              } else {
                // 🔧 FIX: new page starts with 0 existing links of each type
                initialLinkCountsRef.current = { download: 0, watch: 0 };
                setEditingPage({ animeId: '', slug: '', title: '', episodeNumber: 1, links: [] });
                setShowNewForm(true);
              }
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {showNewForm && editingPage && !editingPage._id ? 'Cancel New Page' : '+ New Page'}
          </button>
        </div>

        {/* New Page Form */}
        {showNewForm && editingPage && !editingPage._id && (
          <div className="mt-6">
            <PageForm
              editingPage={editingPage}
              setEditingPage={setEditingPage}
              animeOptions={animeOptions}
              onAnimeChange={handleNewAnimeChange}
              onSave={() => handleSave(editingPage)}
              onCancel={() => { setEditingPage(null); setShowNewForm(false); }}
              calculatingNext={calculatingNext}
              addDownloadLink={addDownloadLink}
              addWatchLink={addWatchLink}
              addBothLinks={addBothLinks}
              updateLink={updateLink}
              removeLink={removeLink}
              watchCount={editingPage.links.filter(l => l.type === 'watch').length}
              downloadCount={editingPage.links.filter(l => l.type === 'download').length}
            />
          </div>
        )}
      </div>

      {/* Filters Section — all filter groups side by side, wrapping together */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          {/* Content Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Type:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setContentTypeFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  contentTypeFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setContentTypeFilter('Anime')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  contentTypeFilter === 'Anime'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Anime
              </button>
              <button
                onClick={() => setContentTypeFilter('Movie')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  contentTypeFilter === 'Movie'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => setContentTypeFilter('Manga')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  contentTypeFilter === 'Manga'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Manga
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Status:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ongoing')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  statusFilter === 'ongoing'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Ongoing
              </button>
              <button
                onClick={() => setStatusFilter('complete')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  statusFilter === 'complete'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Complete
              </button>
            </div>
          </div>

          {/* Sub/Dub Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Sub/Dub:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSubDubFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  subDubFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSubDubFilter('Hindi Sub')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  subDubFilter === 'Hindi Sub'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Hindi Sub
              </button>
              <button
                onClick={() => setSubDubFilter('Hindi Dub')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  subDubFilter === 'Hindi Dub'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Hindi Dub
              </button>
              <button
                onClick={() => setSubDubFilter('English Sub')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  subDubFilter === 'English Sub'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                English Sub
              </button>
            </div>
          </div>

          {/* Visibility Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Visibility:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setVisibilityFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  visibilityFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setVisibilityFilter('visible')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  visibilityFilter === 'visible'
                    ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Visible
              </button>
              <button
                onClick={() => setVisibilityFilter('hidden')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  visibilityFilter === 'hidden'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Hidden
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative ml-auto">
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

        {/* Active filters info */}
        <div className="text-xs text-white/40">
          {filteredPages.length} / {pages.length} pages shown
          {(contentTypeFilter !== 'all' || statusFilter !== 'all' || subDubFilter !== 'all' || visibilityFilter !== 'all') && (
            <button
              onClick={() => {
                setContentTypeFilter('all');
                setStatusFilter('all');
                setSubDubFilter('all');
                setVisibilityFilter('all');
              }}
              className="ml-2 text-purple-400 hover:text-purple-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List of Pages */}
      <div className="space-y-4">
        {sortedPages.length === 0 && !error ? (
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
          sortedPages.map(page => {
            const animeDetails = getAnimeDetails(page);
            // Find page index for this anime based on creation order (_id)
            const animePageList = pagesByAnime.get(animeDetails.animeId) || [];
            const pageIndex = animePageList.findIndex(p => p._id === page._id) + 1;
            const hidden = !!animeDetails.isHidden;

            // Compute episode range
            const episodeNumbers = page.links.map(l => l.episode);
            const minEp = episodeNumbers.length ? Math.min(...episodeNumbers) : null;
            const maxEp = episodeNumbers.length ? Math.max(...episodeNumbers) : null;
            const episodeRange = minEp !== null 
              ? (minEp === maxEp ? `Episode ${minEp}` : `Episode ${minEp}-${maxEp}`)
              : 'No episodes';

            const isEditingThis = editingPage?._id === page._id;

            return (
              <React.Fragment key={page._id}>
                {/* Page Card – now contains the edit form inside */}
                <div className={`group bg-white/5 backdrop-blur-sm border rounded-2xl overflow-hidden shadow-xl transition-all hover:shadow-2xl ${hidden ? 'border-red-500/30' : 'border-white/10 hover:border-white/20'} ${isEditingThis ? 'border-purple-500/30' : ''}`}>
                  {/* Card header (existing content) */}
                  <div className="relative p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Colored left accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${hidden ? 'bg-gradient-to-b from-red-500 to-rose-500' : 'bg-gradient-to-b from-purple-400 to-pink-400'}`}></div>

                    <div className="flex-1 pl-3">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail - fixed dimensions */}
                        <div className="flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden bg-gray-800/80 shadow-lg border border-white/10">
                          {animeDetails.thumbnail ? (
                            <img
                              src={animeDetails.thumbnail}
                              alt={animeDetails.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = 'https://via.placeholder.com/96x128/1e293b/64748b?text=No+Image';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-700/50">
                              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="text-xl font-bold text-white">
                              {animeDetails.title}
                            </h3>
                            {/* Page number badge */}
                            {pageIndex > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-600/30 text-purple-300 border border-purple-500/50">
                                Page {pageIndex}
                              </span>
                            )}
                            {/* Visibility badge (Visible / Hidden) */}
                            {hidden ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-600/30 text-red-300 border border-red-500/50">
                                Hidden
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-600/30 text-green-300 border border-green-500/50">
                                Visible
                              </span>
                            )}
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
                            {/* Sub/Dub Status Badge */}
                            {animeDetails.subDubStatus && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-pink-600/30 text-pink-300 border border-pink-500/50">
                                {animeDetails.subDubStatus}
                              </span>
                            )}
                            {/* Status Badge (Ongoing/Complete) */}
                            {animeDetails.status && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                animeDetails.status.toLowerCase() === 'ongoing'
                                  ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/50'
                                  : animeDetails.status.toLowerCase() === 'complete'
                                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                                  : 'bg-gray-600/30 text-gray-300 border border-gray-500/50'
                              }`}>
                                {animeDetails.status}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-white/70">
                              <span className="text-purple-300 font-medium">Slug:</span> {page.slug}
                            </span>
                            <span className="text-white/70">
                              <span className="text-purple-300 font-medium">Links:</span> {page.links.length}
                            </span>
                            <span className="text-white/70">
                              <span className="text-purple-300 font-medium">Starting Ep:</span> {page.episodeNumber}
                            </span>
                            {page.title && (
                              <span className="text-white/70">
                                <span className="text-purple-300 font-medium">Button:</span> {page.title}
                              </span>
                            )}
                            {/* Episode range */}
                            <span className="text-white/70">
                              <span className="text-purple-300 font-medium">{episodeRange}</span>
                            </span>
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
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 items-center">
                      {/* View button */}
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
                      {/* Edit button */}
                      <button
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingPage(null);
                          } else {
                            setShowNewForm(false);
                            const formPage = convertToFormPage(page);
                            // 🔧 FIX: remember how many download/watch links
                            // already existed BEFORE this editing session began
                            initialLinkCountsRef.current = {
                              download: formPage.links.filter(l => l.type === 'download').length,
                              watch: formPage.links.filter(l => l.type === 'watch').length,
                            };
                            setEditingPage(formPage);
                          }
                        }}
                        title="Edit page"
                        className="p-2.5 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl text-white/80 hover:text-indigo-300 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => requestDelete(page._id)}
                        title="Delete page"
                        className="p-2.5 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-xl text-white/80 hover:text-rose-300 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Form – now inside the card, full width, same padding */}
                  {isEditingThis && (
                    <div className="px-5 pb-5">
                      <div className="border-t border-white/10 pt-4">
                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                          <span className="w-1.5 h-8 bg-purple-400 rounded-full"></span>
                          Editing Page {pageIndex}
                        </h3>
                        <PageForm
                          editingPage={editingPage}
                          setEditingPage={setEditingPage}
                          animeOptions={animeOptions}
                          onAnimeChange={handleEditAnimeChange}
                          onSave={() => handleSave(editingPage)}
                          onCancel={() => setEditingPage(null)}
                          calculatingNext={calculatingNext}
                          addDownloadLink={addDownloadLink}
                          addWatchLink={addWatchLink}
                          addBothLinks={addBothLinks}
                          updateLink={updateLink}
                          removeLink={removeLink}
                          watchCount={editingPage.links.filter(l => l.type === 'watch').length}
                          downloadCount={editingPage.links.filter(l => l.type === 'download').length}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

// Extracted Page Form component
const PageForm: React.FC<{
  editingPage: FormPage;
  setEditingPage: React.Dispatch<React.SetStateAction<FormPage | null>>;
  animeOptions: AnimeOption[];
  onAnimeChange: (option: AnimeOption | null) => void;
  onSave: () => void;
  onCancel: () => void;
  calculatingNext: boolean;
  addDownloadLink: () => Promise<void>;
  addWatchLink: () => Promise<void>;
  addBothLinks: () => Promise<void>;
  updateLink: (index: number, field: keyof DownloadPageLink, value: any) => void;
  removeLink: (index: number) => void;
  watchCount: number;
  downloadCount: number;
}> = ({
  editingPage,
  setEditingPage,
  animeOptions,
  onAnimeChange,
  onSave,
  onCancel,
  calculatingNext,
  addDownloadLink,
  addWatchLink,
  addBothLinks,
  updateLink,
  removeLink,
  watchCount,
  downloadCount
}) => {
  return (
    <div className="space-y-6">
      {/* Anime Selector */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2 flexl items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-400 rounded-full"></span>
          Anime *
        </label>
        <SearchableDropdown
          options={animeOptions}
          value={animeOptions.find(a => a._id === editingPage.animeId) || null}
          onChange={onAnimeChange}
          placeholder="Search anime..."
        />
        {calculatingNext && <Spinner size="sm" className="mt-2" />}
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2 flexl items-center gap-2">
          <span className="w-1.5 h-5 bg-indigo-400 rounded-full"></span>
          Slug (unique) *
        </label>
        <input
          type="text"
          value={editingPage.slug || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, slug: e.target.value } : null)}
          className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          placeholder="e.g., naruto-eps-1-10"
        />
      </div>

      {/* Starting Episode Number – independent */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2 flexl items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
          Starting Episode Number (reference only) *
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={editingPage.episodeNumber || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, episodeNumber: parseInt(e.target.value) || 1 } : null)}
          className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          placeholder="e.g., 1"
        />
        <p className="text-xs text-white/40 mt-1">
          This is just a reference. It does NOT affect link numbering.
        </p>
      </div>

      {/* Button Title */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2 flexl items-center gap-2">
          <span className="w-1.5 h-5 bg-pink-400 rounded-full"></span>
          Button Title
        </label>
        <input
          type="text"
          value={editingPage.title || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, title: e.target.value } : null)}
          className="w-full px-5 py-3 bg-gray-800/60 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          placeholder="Download"
        />
      </div>

      {/* Links */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3 flexl items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
          Links (unlimited)
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

        <div className="flex gap-3 mt-2 flex-wrap">
          <button
            onClick={addDownloadLink}
            disabled={calculatingNext}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-xl text-blue-200 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculatingNext ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
            + Add Download Link ({downloadCount})
          </button>
          <button
            onClick={addWatchLink}
            disabled={calculatingNext}
            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-xl text-green-200 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculatingNext ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            + Add Watch Link ({watchCount})
          </button>
          <button
            onClick={addBothLinks}
            disabled={calculatingNext}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl text-purple-200 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            + Add Both (Download + Watch)
          </button>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 font-medium transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
      </div>
    </div>
  );
};

export default DownloadPageManager;