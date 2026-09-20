 // src/components/admin/DownloadPageManager.tsx – Premium UI, mobile-friendly
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DownloadPage, DownloadPageLink, ContentType, SubDubStatus } from '../../types';
import SearchableDropdown from './SearchableDropdown';
import Spinner from '../Spinner';
import { CONTENT_TYPE_OPTIONS } from '../../utils/contentGroup';
import { isYouTubeUrl } from '@components/utils/videoHelpers';

const API_BASE = import.meta.env.VITE_API_BASE || 
  'https://animabing-backend.animabingwatch.workers.dev/api';

const getFrontendBase = () => {
  if (typeof window === 'undefined') return 'https://animebing.in';
  return window.location.origin;
};

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string; fill?: boolean }> = ({ d, className = 'w-4 h-4', fill = false }) => (
  <svg className={className} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  download:    'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  plus:        'M12 4v16m8-8H4',
  close:       'M6 18L18 6M6 6l12 12',
  search:      'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  warning:     'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:       'M5 13l4 4L19 7',
  star:        'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  eye:         'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  edit:        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:       'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  tag:         'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  play:        'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
  target:      'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  youtube:     'M21.582 7.203a2.51 2.51 0 00-1.766-1.778C18.254 5 12 5 12 5s-6.254 0-7.816.425A2.51 2.51 0 002.418 7.203 26.14 26.14 0 002 12a26.14 26.14 0 00.418 4.797 2.51 2.51 0 001.766 1.778C5.746 19 12 19 12 19s6.254 0 7.816-.425a2.51 2.51 0 001.766-1.778A26.14 26.14 0 0022 12a26.14 26.14 0 00-.418-4.797zM10 15V9l5.196 3z',
  save:        'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  empty:       'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  folder:      'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  bolt:        'M13 10V3L4 14h7v7l9-11h-7z',
};

// ============ CUSTOM STYLED DROPDOWN ============
interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  color?: string;
}

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
  className?: string;
}> = ({ value, onChange, options, icon, label, required, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
        {icon}
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full bg-white/[0.04] border text-white rounded-lg px-2.5 py-1.5 text-xs text-left transition-all flex items-center justify-between gap-1.5 ${
          isOpen ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-white/[0.08] hover:border-white/[0.14]'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected?.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selected.color} flex-shrink-0`} />}
          <span className="truncate font-medium">{selected?.label || 'Select...'}</span>
        </span>
        <SvgIcon d="M19 9l-7 7-7-7" className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[999] mt-1 w-full bg-[#151422] border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1 max-h-72 overflow-y-auto">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-purple-500/15 text-purple-200' : 'text-gray-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.color && <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${opt.color} flex-shrink-0`} />}
                  <span className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{opt.label}</span>
                    {opt.hint && <span className="text-[10px] text-gray-500 truncate">{opt.hint}</span>}
                  </span>
                </span>
                {isSelected && <SvgIcon d={ICONS.check} className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface DownloadPageManagerProps {
  token?: string;
  subAdminMode?: boolean;
}

interface AnimeOption {
  _id: string;
  title: string;
  thumbnail?: string;
}

interface FormPage {
  _id?: string;
  animeId: string;
  slug: string;
  title: string;
  episodeNumber: number;
  links: DownloadPageLink[];
  defaultPlayerMode?: 'custom' | 'default';
}

const getAnimeTitle = (page: DownloadPage): string => {
  if (page.animeId && typeof page.animeId === 'object' && 'title' in page.animeId) {
    return page.animeId.title;
  }
  return 'Unknown Anime';
};

const isAnimeHidden = (page: DownloadPage): boolean => {
  if (page.animeId && typeof page.animeId === 'object') {
    return !!(page.animeId as any).isHidden;
  }
  return false;
};

const hasYouTubeWatchLink = (page: DownloadPage): boolean => {
  return (page.links || []).some(l => l.type === 'watch' && isYouTubeUrl(l.url));
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
    success: 'bg-emerald-500/[0.12] border-emerald-500/30 text-emerald-200',
    error: 'bg-rose-500/[0.12] border-rose-500/30 text-rose-200',
    info: 'bg-sky-500/[0.12] border-sky-500/30 text-sky-200',
  }[toast.type];

  const iconPath = {
    success: ICONS.check,
    error: ICONS.close,
    info: ICONS.warning,
  }[toast.type];

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[999] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${bgColor}`}>
        <SvgIcon d={iconPath} className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs font-semibold">{toast.message}</span>
        <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
          <SvgIcon d={ICONS.close} className="w-3.5 h-3.5" />
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
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151422] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
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
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/25 hover:shadow-red-500/40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Main Component -----
const DownloadPageManager: React.FC<DownloadPageManagerProps> = ({
  token: tokenProp,
  subAdminMode = false,
}) => {
  const resolveToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [pages, setPages] = useState<DownloadPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<FormPage | null>(null);
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [animeThumbnails, setAnimeThumbnails] = useState<Map<string, string>>(new Map());
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [calculatingNext, setCalculatingNext] = useState(false);

  const [pageLinksMap, setPageLinksMap] = useState<Record<string, { episodeLimit: number; keyword: string; channelName: string }>>({});

  const fetchPageLinks = async () => {
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/track/page-links`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setPageLinksMap(await res.json());
    } catch { /* silent */ }
  };

  const initialLinkCountsRef = useRef<{ download: number; watch: number }>({ download: 0, watch: 0 });

  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };
  const closeToast = () => setToast(prev => ({ ...prev, visible: false }));

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({ show: false, id: null });
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [togglingPlayerModeId, setTogglingPlayerModeId] = useState<string | null>(null);

  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | ContentType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'complete'>('all');
  const [subDubFilter, setSubDubFilter] = useState<'all' | string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [subAdminFilter, setSubAdminFilter] = useState<'all' | 'admin' | 'subadmin'>('all');
  const [playerModeFilter, setPlayerModeFilter] = useState<'all' | 'custom' | 'default'>('all');

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/download-pages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPages(data.map((p: any) => ({ ...p, links: Array.isArray(p.links) ? p.links : [] })));
      } else if (data.data && Array.isArray(data.data)) {
        setPages(data.data.map((p: any) => ({ ...p, links: Array.isArray(p.links) ? p.links : [] })));
      } else {
        setPages([]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch pages');
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnime = async () => {
    try {
      const token = resolveToken();
      const url = `${API_BASE}/admin/protected/anime-list`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const animeArray = json.data || json;
      if (Array.isArray(animeArray)) {
        const normalizeThumb = (a: any) => {
          let thumb = a.thumbnail || a.image || a.poster || a.cover;
          if (thumb && !thumb.startsWith('http')) {
            thumb = `${API_BASE}${thumb.startsWith('/') ? '' : '/'}${thumb}`;
          }
          return thumb;
        };
        setAnimeOptions(animeArray.map((a: any) => ({
          _id: a._id,
          title: a.title,
          thumbnail: normalizeThumb(a)
        })));
        const map = new Map<string, string>();
        animeArray.forEach((a: any) => {
          const thumb = normalizeThumb(a);
          if (thumb) map.set(a._id, thumb);
        });
        setAnimeThumbnails(map);
      } else {
        setAnimeOptions([]);
      }
    } catch {
      setAnimeOptions([]);
    }
  };

  const getNextStartingEpisode = async (animeId: string): Promise<number> => {
    if (!animeId) return 1;
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/download-pages/anime/${animeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) return 1;
      const animePages = await res.json();
      if (!Array.isArray(animePages)) return 1;
      let maxEpisode = 0;
      animePages.forEach((page: DownloadPage) => {
        (page.links || []).forEach(link => {
          if (link.episode > maxEpisode) maxEpisode = link.episode;
        });
      });
      return maxEpisode + 1;
    } catch {
      return 1;
    }
  };

  useEffect(() => {
    fetchPages();
    fetchAnime();
    fetchPageLinks();
  }, []);

  const convertToFormPage = (page: DownloadPage): FormPage => ({
    _id: page._id,
    animeId: typeof page.animeId === 'string' ? page.animeId : page.animeId._id,
    slug: page.slug,
    title: page.title,
    episodeNumber: page.episodeNumber || 1,
    defaultPlayerMode: page.defaultPlayerMode || 'default',
    links: (page.links || []).map(link => ({
      ...link,
      type: (link as any).type || 'download'
    }))
  });

  const getAnimeDetails = (page: DownloadPage): { 
    title: string; 
    contentType?: ContentType; 
    subDubStatus?: SubDubStatus;
    status?: string;
    thumbnail?: string;
    animeId: string;
    isHidden?: boolean;
    createdByUsername?: string;
    isSubAdminCreated?: boolean;
  } => {
    if (page.animeId && typeof page.animeId === 'object') {
      const animeObj = page.animeId as any;
      let thumbnail = animeObj.thumbnail || animeObj.image || animeObj.poster || animeObj.cover;
      if (!thumbnail && animeObj._id) {
        thumbnail = animeThumbnails.get(animeObj._id);
      }
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
        isHidden: !!animeObj.isHidden,
        createdByUsername: animeObj.createdByUsername || undefined,
        isSubAdminCreated: !!animeObj.isSubAdminCreated
      };
    }
    return { title: 'Unknown Anime', animeId: typeof page.animeId === 'string' ? page.animeId : '' };
  };

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

  const handleEditAnimeChange = (option: AnimeOption | null) => {
    const animeId = option?._id || '';
    setEditingPage(prev => prev ? { ...prev, animeId } : null);
  };

  const handleSave = async (pageToSave: FormPage) => {
    if (!pageToSave.animeId) { showToast('Please select an anime', 'error'); return; }
    if (!pageToSave.slug) { showToast('Please enter a slug', 'error'); return; }
    if (!pageToSave.episodeNumber || pageToSave.episodeNumber < 1) {
      showToast('Please enter a valid episode number', 'error'); return;
    }

    const method = pageToSave._id ? 'PUT' : 'POST';
    const url = pageToSave._id
      ? `${API_BASE}/download-pages/${pageToSave._id}`
      : `${API_BASE}/download-pages`;

    try {
      const token = resolveToken();
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
    } catch {
      showToast('Network error. Check console.', 'error');
    }
  };

  const requestDelete = (id: string) => {
    setDeleteConfirm({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const token = resolveToken();
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
    } catch {
      showToast('Network error while deleting', 'error');
    } finally {
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleSetPrimary = async (pageId: string) => {
    setSettingPrimaryId(pageId);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/download-pages/${pageId}/set-primary-episode-count`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
      });
      if (res.ok) {
        const data = await res.json();
        fetchPages();
        showToast(`Primary set ho gaya! Ab badge episode ${data.currentEpisode} dikhayega.`, 'success');
      } else {
        showToast('Set primary fail ho gaya', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleUnsetPrimary = async (pageId: string) => {
    setSettingPrimaryId(pageId);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/download-pages/${pageId}/unset-primary-episode-count`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
      });
      if (res.ok) {
        const data = await res.json();
        fetchPages();
        showToast(`Primary hata diya. Ab badge episode ${data.currentEpisode} dikhayega.`, 'success');
      } else {
        showToast('Unset primary fail ho gaya', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleTogglePlayerMode = async (pageId: string, currentMode: 'custom' | 'default') => {
    const nextMode = currentMode === 'custom' ? 'default' : 'custom';
    setTogglingPlayerModeId(pageId);
    try {
      const token = resolveToken();
      const res = await fetch(`${API_BASE}/download-pages/${pageId}/player-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ defaultPlayerMode: nextMode }),
      });
      if (res.ok) {
        setPages(prev => prev.map(p => p._id === pageId ? { ...p, defaultPlayerMode: nextMode } : p));
        showToast(`Player mode set to ${nextMode === 'custom' ? 'Custom' : 'Default'}`, 'success');
      } else {
        showToast('Failed to update player mode', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setTogglingPlayerModeId(null);
    }
  };

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

  const pagesByAnime = useMemo(() => {
    const map = new Map<string, DownloadPage[]>();
    pages.forEach(page => {
      const animeId = getAnimeDetails(page).animeId;
      if (!animeId) return;
      if (!map.has(animeId)) map.set(animeId, []);
      map.get(animeId)!.push(page);
    });
    map.forEach((list) => {
      list.sort((a, b) => a._id.localeCompare(b._id));
    });
    return map;
  }, [pages]);

  const ownedAnimeIdSet = useMemo(() => {
    if (!subAdminMode) return null;
    return new Set(animeOptions.map(a => a._id));
  }, [subAdminMode, animeOptions]);

  const hasSubAdminPages = useMemo(() => {
    if (subAdminMode) return false;
    return pages.some(page => getAnimeDetails(page).isSubAdminCreated);
  }, [pages, subAdminMode]);

  const hasAnyYouTubeLinks = useMemo(() => {
    return pages.some(page => hasYouTubeWatchLink(page));
  }, [pages]);

  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const details = getAnimeDetails(page);
      if (subAdminMode && ownedAnimeIdSet && !ownedAnimeIdSet.has(details.animeId)) return false;
      const animeTitle = getAnimeTitle(page).toLowerCase();
      const term = searchTerm.toLowerCase();
      if (!animeTitle.includes(term)) return false;
      if (contentTypeFilter !== 'all' && details.contentType !== contentTypeFilter) return false;
      if (statusFilter !== 'all') {
        const animeStatus = details.status?.toLowerCase();
        if (statusFilter === 'ongoing' && animeStatus !== 'ongoing') return false;
        if (statusFilter === 'complete' && animeStatus !== 'complete') return false;
      }
      if (subDubFilter !== 'all' && details.subDubStatus !== subDubFilter) return false;
      if (visibilityFilter === 'visible' && details.isHidden) return false;
      if (visibilityFilter === 'hidden' && !details.isHidden) return false;
      if (subAdminFilter === 'subadmin' && !details.isSubAdminCreated) return false;
      if (subAdminFilter === 'admin' && details.isSubAdminCreated) return false;
      if (playerModeFilter !== 'all') {
        const pagePlayerMode = page.defaultPlayerMode || 'default';
        if (pagePlayerMode !== playerModeFilter) return false;
      }
      return true;
    });
  }, [pages, searchTerm, contentTypeFilter, statusFilter, subDubFilter, visibilityFilter, subAdminFilter, playerModeFilter, subAdminMode, ownedAnimeIdSet]);

  const sortedPages = useMemo(() => {
    const groups = new Map<string, DownloadPage[]>();
    filteredPages.forEach(page => {
      const animeId = getAnimeDetails(page).animeId;
      if (!groups.has(animeId)) groups.set(animeId, []);
      groups.get(animeId)!.push(page);
    });
    groups.forEach(list => list.sort((a, b) => a._id.localeCompare(b._id)));
    const groupEntries = Array.from(groups.entries());
    groupEntries.sort((a, b) => {
      const aLatestPageId = a[1][a[1].length - 1]._id;
      const bLatestPageId = b[1][b[1].length - 1]._id;
      return bLatestPageId.localeCompare(aLatestPageId);
    });
    return groupEntries.flatMap(([, list]) => list);
  }, [filteredPages]);

  const hasActiveFilters =
    contentTypeFilter !== 'all' || statusFilter !== 'all' || subDubFilter !== 'all' ||
    visibilityFilter !== 'all' || subAdminFilter !== 'all' || playerModeFilter !== 'all';

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0b0a14]">
      <Spinner size="lg" text="Loading download pages..." />
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 min-h-screen bg-[#0b0a14] text-white">
      <Toast toast={toast} onClose={closeToast} />
      <ConfirmModal
        open={deleteConfirm.show}
        title="Delete Page"
        message="Are you sure you want to delete this download page? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
      />

      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 shadow-lg shadow-purple-500/10">
          <SvgIcon d={ICONS.download} className="w-6 h-6 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Download Pages</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage download pages and links</p>
        </div>
        {pages.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
            {filteredPages.length} / {pages.length}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl text-rose-200 text-xs">
          <SvgIcon d={ICONS.warning} className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── New Page Form Toggle ─────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-400 rounded-full" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Create New Download Page
            </h2>
          </div>
          <button
            onClick={() => {
              if (showNewForm && editingPage && !editingPage._id) {
                setShowNewForm(false);
                setEditingPage(null);
              } else {
                initialLinkCountsRef.current = { download: 0, watch: 0 };
                setEditingPage({ animeId: '', slug: '', title: '', episodeNumber: 1, links: [], defaultPlayerMode: 'default' });
                setShowNewForm(true);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              showNewForm && editingPage && !editingPage._id
                ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            <SvgIcon d={showNewForm && editingPage && !editingPage._id ? ICONS.close : ICONS.plus} className="w-3.5 h-3.5" />
            {showNewForm && editingPage && !editingPage._id ? 'Cancel' : 'New Page'}
          </button>
        </div>

        {showNewForm && editingPage && !editingPage._id && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
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

      {/* ─── Filters ──────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 relative z-20">
        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            label="Type"
            value={contentTypeFilter}
            onChange={(v) => setContentTypeFilter(v as 'all' | ContentType)}
            options={[
              { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
              { value: 'Movie', label: 'Movie', color: 'from-purple-500 to-pink-500' },
              ...CONTENT_TYPE_OPTIONS.map(ct => ({
                value: ct,
                label: ct,
                color:
                  ct === 'Anime' ? 'from-blue-500 to-cyan-500' :
                  ct === 'Ai Anime' ? 'from-violet-500 to-fuchsia-500' :
                  ct === 'Manga' ? 'from-emerald-500 to-teal-500' :
                  ct === 'Ai Manhwa' ? 'from-fuchsia-500 to-purple-500' :
                  ct === 'Hollywood Movie' ? 'from-amber-500 to-orange-500' :
                  ct === 'Bollywood Movie' ? 'from-red-500 to-rose-500' :
                  ct === 'Web Series' ? 'from-indigo-500 to-blue-500' :
                  'from-gray-500 to-gray-400'
              }))
            ]}
            className="w-[calc(50%-4px)] sm:w-32 shrink-0"
          />

          <CustomSelect
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'all' | 'ongoing' | 'complete')}
            options={[
              { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
              { value: 'ongoing', label: 'Ongoing', color: 'from-yellow-500 to-orange-500' },
              { value: 'complete', label: 'Complete', color: 'from-green-500 to-emerald-500' },
            ]}
            className="w-[calc(50%-4px)] sm:w-28 shrink-0"
          />

          <CustomSelect
            label="Sub/Dub"
            value={subDubFilter}
            onChange={(v) => setSubDubFilter(v)}
            options={[
              { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
              { value: 'Hindi Sub', label: 'Hindi Sub', color: 'from-orange-500 to-amber-500' },
              { value: 'Hindi Dub', label: 'Hindi Dub', color: 'from-red-500 to-orange-500' },
              { value: 'English Sub', label: 'English Sub', color: 'from-blue-500 to-cyan-500' },
            ]}
            className="w-[calc(50%-4px)] sm:w-32 shrink-0"
          />

          <CustomSelect
            label="Visibility"
            value={visibilityFilter}
            onChange={(v) => setVisibilityFilter(v as 'all' | 'visible' | 'hidden')}
            options={[
              { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
              { value: 'visible', label: 'Visible', color: 'from-green-500 to-emerald-500' },
              { value: 'hidden', label: 'Hidden', color: 'from-red-500 to-rose-500' },
            ]}
            className="w-[calc(50%-4px)] sm:w-28 shrink-0"
          />

          {hasAnyYouTubeLinks && (
            <CustomSelect
              label="Player"
              value={playerModeFilter}
              onChange={(v) => setPlayerModeFilter(v as 'all' | 'custom' | 'default')}
              options={[
                { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
                { value: 'custom', label: 'Custom', color: 'from-purple-500 to-pink-500' },
                { value: 'default', label: 'Default', color: 'from-blue-500 to-cyan-500' },
              ]}
              className="w-[calc(50%-4px)] sm:w-28 shrink-0"
            />
          )}

          {!subAdminMode && hasSubAdminPages && (
            <CustomSelect
              label="Creator"
              value={subAdminFilter}
              onChange={(v) => setSubAdminFilter(v as 'all' | 'admin' | 'subadmin')}
              options={[
                { value: 'all', label: 'All', color: 'from-gray-500 to-gray-400' },
                { value: 'admin', label: 'Admin', color: 'from-blue-500 to-cyan-500' },
                { value: 'subadmin', label: 'Sub Admin', color: 'from-amber-500 to-orange-500' },
              ]}
              className="w-[calc(50%-4px)] sm:w-28 shrink-0"
            />
          )}

          <div className="relative w-full sm:w-64 sm:ml-auto">
            <SvgIcon d={ICONS.search} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-gray-500">Filters active</span>
            <button
              onClick={() => {
                setContentTypeFilter('all');
                setStatusFilter('all');
                setSubDubFilter('all');
                setVisibilityFilter('all');
                setSubAdminFilter('all');
                setPlayerModeFilter('all');
              }}
              className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ─── Pages List ───────────────────────────────── */}
      <div className="space-y-3">
        {sortedPages.length === 0 && !error ? (
          <div className="text-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <SvgIcon d={ICONS.empty} className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 font-medium">
              {searchTerm ? 'No download pages found for this anime' : 'No download pages found'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              {searchTerm ? 'Try a different anime title' : 'Create your first page above'}
            </p>
          </div>
        ) : (
          sortedPages.map(page => {
            const animeDetails = getAnimeDetails(page);
            const animePageList = pagesByAnime.get(animeDetails.animeId) || [];
            const pageIndex = animePageList.findIndex(p => p._id === page._id) + 1;
            const hidden = !!animeDetails.isHidden;

            const episodeNumbers = (page.links || []).map(l => l.episode);
            const minEp = episodeNumbers.length ? Math.min(...episodeNumbers) : null;
            const maxEp = episodeNumbers.length ? Math.max(...episodeNumbers) : null;
            const episodeRange = minEp !== null 
              ? (minEp === maxEp ? `Ep ${minEp}` : `Ep ${minEp}-${maxEp}`)
              : 'No episodes';

            const isEditingThis = editingPage?._id === page._id;

            return (
              <React.Fragment key={page._id}>
                <div className={`relative bg-white/[0.03] border rounded-2xl overflow-hidden transition-all hover:border-white/[0.12] ${
                  hidden ? 'border-rose-500/25' : 'border-white/[0.06]'
                } ${isEditingThis ? 'border-purple-500/30' : ''}`}>
                  <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${
                    hidden ? 'bg-gradient-to-b from-rose-500 to-red-500' : 'bg-gradient-to-b from-purple-400 to-pink-400'
                  }`} />

                  <div className="p-3 sm:p-4 pl-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 h-16 sm:w-16 sm:h-20 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.08]">
                          {animeDetails.thumbnail ? (
                            <img
                              src={animeDetails.thumbnail}
                              alt={animeDetails.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = 'https://via.placeholder.com/96x128/1e293b/64748b?text=NA';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <SvgIcon d={ICONS.download} className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <h3 className="text-sm font-bold text-white truncate">
                              {animeDetails.title}
                            </h3>
                            {pageIndex > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                Page {pageIndex}
                              </span>
                            )}
                            {animePageList.length > 1 && (page as any).isPrimaryForEpisodeCount && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                                <SvgIcon d={ICONS.star} className="w-2.5 h-2.5" fill />
                                Primary
                              </span>
                            )}
                            {hidden ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                Hidden
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                Visible
                              </span>
                            )}
                            {pageLinksMap[page._id] && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                                title={`Tracker: ${pageLinksMap[page._id].channelName} — ${pageLinksMap[page._id].keyword}`}
                              >
                                <SvgIcon d={ICONS.target} className="w-2.5 h-2.5" />
                                Limit: {pageLinksMap[page._id].episodeLimit || '∞'}
                              </span>
                            )}
                            {animeDetails.contentType && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                                animeDetails.contentType === 'Movie'
                                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/25'
                                  : animeDetails.contentType === 'Manga'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                                  : 'bg-blue-500/15 text-blue-300 border-blue-500/25'
                              }`}>
                                {animeDetails.contentType}
                              </span>
                            )}
                            {animeDetails.subDubStatus && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                                animeDetails.subDubStatus === 'Hindi Dub' ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                                  : animeDetails.subDubStatus === 'Hindi Sub' ? 'bg-orange-500/15 text-orange-300 border-orange-500/25'
                                  : animeDetails.subDubStatus === 'English Sub' ? 'bg-sky-500/15 text-sky-300 border-sky-500/25'
                                  : 'bg-purple-500/15 text-purple-300 border-purple-500/25'
                              }`}>
                                {animeDetails.subDubStatus}
                              </span>
                            )}
                            {animeDetails.status && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                                animeDetails.status.toLowerCase() === 'ongoing'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                                  : animeDetails.status.toLowerCase() === 'complete'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                                  : 'bg-gray-500/15 text-gray-300 border-gray-500/25'
                              }`}>
                                {animeDetails.status}
                              </span>
                            )}
                            {!subAdminMode && animeDetails.isSubAdminCreated && animeDetails.createdByUsername && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                By: {animeDetails.createdByUsername}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            <span className="hidden sm:inline text-gray-400">
                              Slug: <span className="text-purple-300 font-mono font-semibold">{page.slug}</span>
                            </span>
                            <span className="text-gray-400">
                              Links: <span className="text-white font-bold">{(page.links || []).length}</span>
                            </span>
                            <span className="text-gray-400">
                              Start: <span className="text-white font-bold">{page.episodeNumber}</span>
                            </span>
                            {page.title && (
                              <span className="text-gray-400">
                                Button: <span className="text-purple-300 font-semibold">{page.title}</span>
                              </span>
                            )}
                            <span className="text-purple-300 font-bold">{episodeRange}</span>
                            {hasYouTubeWatchLink(page) && (
                              <span className="text-gray-400">
                                Player: <span className={`font-bold ${
                                  (page.defaultPlayerMode || 'default') === 'custom' ? 'text-purple-300' : 'text-sky-300'
                                }`}>
                                  {page.defaultPlayerMode || 'default'}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                            {(() => {
                              const downloadCount = (page.links || []).filter(l => l.type === 'download').length;
                              const watchCount = (page.links || []).filter(l => l.type === 'watch').length;
                              return (
                                <>
                                  <span className="inline-flex items-center gap-1 text-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Download: <span className="font-bold">{downloadCount}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-sky-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                    Watch: <span className="font-bold">{watchCount}</span>
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 items-center flex-wrap sm:flex-nowrap pl-3 sm:pl-0">
                      <button
                        onClick={() => window.open(`${getFrontendBase()}/download/${page.slug}`, '_blank')}
                        title="View public page"
                        className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 transition-all"
                      >
                        <SvgIcon d={ICONS.eye} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingPage(null);
                          } else {
                            setShowNewForm(false);
                            const formPage = convertToFormPage(page);
                            initialLinkCountsRef.current = {
                              download: formPage.links.filter(l => l.type === 'download').length,
                              watch: formPage.links.filter(l => l.type === 'watch').length,
                            };
                            setEditingPage(formPage);
                          }
                        }}
                        title="Edit page"
                        className={`p-2 rounded-lg border transition-all ${
                          isEditingThis
                            ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                            : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-indigo-300'
                        }`}
                      >
                        <SvgIcon d={ICONS.edit} className="w-4 h-4" />
                      </button>
                      
                      {hasYouTubeWatchLink(page) && (
                        <button
                          onClick={() => handleTogglePlayerMode(page._id, page.defaultPlayerMode || 'default')}
                          disabled={togglingPlayerModeId === page._id}
                          title={
                            (page.defaultPlayerMode || 'default') === 'custom'
                              ? 'Custom Player active — click to switch to Default YouTube Player'
                              : 'Default YouTube Player active — click to switch to Custom Player'
                          }
                          className={`p-2 rounded-lg border transition-all disabled:opacity-50 ${
                            (page.defaultPlayerMode || 'default') === 'custom'
                              ? 'bg-purple-500/15 border-purple-500/25 text-purple-300 hover:bg-purple-500/25'
                              : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-rose-500/10 hover:border-rose-500/25 hover:text-rose-300'
                          }`}
                        >
                          {togglingPlayerModeId === page._id ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <SvgIcon d={ICONS.youtube} className="w-4 h-4" fill />
                          )}
                        </button>
                      )}
                      
                      {animePageList.length > 1 && (
                        <button
                          onClick={() =>
                            (page as any).isPrimaryForEpisodeCount
                              ? handleUnsetPrimary(page._id)
                              : handleSetPrimary(page._id)
                          }
                          disabled={settingPrimaryId === page._id}
                          title={
                            (page as any).isPrimaryForEpisodeCount
                              ? 'Primary hatao (wapas combined-max pe jao)'
                              : 'Is page ko Episode Badge ka source banao'
                          }
                          className={`p-2 rounded-lg border transition-all disabled:opacity-50 ${
                            (page as any).isPrimaryForEpisodeCount
                              ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25'
                              : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-cyan-500/10 hover:border-cyan-500/25 hover:text-cyan-300'
                          }`}
                        >
                          {settingPrimaryId === page._id ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <SvgIcon d={ICONS.star} className="w-4 h-4" fill={(page as any).isPrimaryForEpisodeCount} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => requestDelete(page._id)}
                        title="Delete page"
                        className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-rose-500/10 hover:border-rose-500/25 hover:text-rose-300 transition-all"
                      >
                        <SvgIcon d={ICONS.trash} className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isEditingThis && (
                    <div className="px-3 sm:px-4 pb-4 border-t border-white/[0.06] pt-4 pl-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-1 h-4 bg-purple-400 rounded-full" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Editing Page {pageIndex}
                        </h3>
                      </div>
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

// ---------- PAGE FORM ----------
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
  const [hostnameSuggestions, setHostnameSuggestions] = useState<{ hostname: string; label: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('subAdminToken') || '';
    fetch(`${API_BASE}/r2-providers/hostnames`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => Array.isArray(data) && setHostnameSuggestions(data))
      .catch(() => {});
  }, []);

  const inputCls = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-purple-500/20";

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          <span className="w-1 h-3.5 bg-emerald-400 rounded-full" />
          Anime *
        </label>
        <SearchableDropdown
          options={animeOptions}
          value={animeOptions.find(a => a._id === editingPage.animeId) || null}
          onChange={onAnimeChange}
          placeholder="Search anime..."
        />
        {calculatingNext && <div className="mt-2"><Spinner size="sm" /></div>}
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          <span className="w-1 h-3.5 bg-indigo-400 rounded-full" />
          Slug (unique) *
        </label>
        <input
          type="text"
          value={editingPage.slug || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, slug: e.target.value } : null)}
          className={`${inputCls} font-mono`}
          placeholder="e.g., naruto-eps-1-10"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          <span className="w-1 h-3.5 bg-amber-400 rounded-full" />
          Starting Episode (reference only) *
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={editingPage.episodeNumber || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, episodeNumber: parseInt(e.target.value) || 1 } : null)}
          className={inputCls}
          placeholder="e.g., 1"
        />
        <p className="text-[10px] text-gray-500 mt-1">
          This is just a reference. It does NOT affect link numbering.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          <span className="w-1 h-3.5 bg-pink-400 rounded-full" />
          Button Title
        </label>
        <input
          type="text"
          value={editingPage.title || ''}
          onChange={e => setEditingPage(prev => prev ? { ...prev, title: e.target.value } : null)}
          className={inputCls}
          placeholder="Download"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
          <span className="w-1 h-3.5 bg-amber-400 rounded-full" />
          Links (unlimited)
        </label>
        {editingPage.links?.map((link, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 mb-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2">
              <div className="sm:col-span-1">
                <label className="block text-[10px] text-gray-500 mb-0.5 sm:hidden">Start</label>
                <input
                  type="number"
                  placeholder="Start"
                  value={link.episodeStart ?? ''}
                  onChange={e => updateLink(idx, 'episodeStart', e.target.value ? parseInt(e.target.value) : undefined)}
                  className={inputCls}
                  min="1"
                  title="Range ka starting episode"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] text-gray-500 mb-0.5 sm:hidden">Ep</label>
                <input
                  type="number"
                  placeholder="Ep"
                  value={link.episode}
                  onChange={e => updateLink(idx, 'episode', parseInt(e.target.value) || 1)}
                  className={inputCls}
                  min="1"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] text-gray-500 mb-0.5 sm:hidden">Type</label>
                <select
                  value={link.type}
                  onChange={e => updateLink(idx, 'type', e.target.value as 'download' | 'watch')}
                  className={inputCls}
                >
                  <option value="download" className="bg-slate-900">Download</option>
                  <option value="watch" className="bg-slate-900">Watch</option>
                </select>
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[10px] text-gray-500 mb-0.5 sm:hidden">URL</label>
                <input
                  type="url"
                  placeholder="URL (e.g. https://subadmin1-videos.internal/filename.mkv)"
                  value={link.url}
                  onChange={e => updateLink(idx, 'url', e.target.value)}
                  list="hostname-suggestions"
                  className={`${inputCls} font-mono`}
                />
                <datalist id="hostname-suggestions">
                  {hostnameSuggestions.map(h => (
                    <option key={h.hostname} value={`https://${h.hostname}/`}>{h.label}</option>
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2 flex sm:justify-end">
                <button
                  onClick={() => removeLink(idx)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 rounded-lg text-[11px] font-bold transition-all"
                >
                  <SvgIcon d={ICONS.trash} className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Quality (e.g., 1080p)"
                value={link.quality || ''}
                onChange={e => updateLink(idx, 'quality', e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Language (e.g., English)"
                value={link.language || ''}
                onChange={e => updateLink(idx, 'language', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            onClick={addDownloadLink}
            disabled={calculatingNext}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 text-[11px] font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {calculatingNext ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <SvgIcon d={ICONS.plus} className="w-3.5 h-3.5" />
            )}
            Download ({downloadCount})
          </button>
          <button
            onClick={addWatchLink}
            disabled={calculatingNext}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {calculatingNext ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <SvgIcon d={ICONS.play} className="w-3.5 h-3.5" />
            )}
            Watch ({watchCount})
          </button>
          <button
            onClick={addBothLinks}
            disabled={calculatingNext}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 text-purple-300 text-[11px] font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SvgIcon d={ICONS.plus} className="w-3.5 h-3.5" />
            Both
          </button>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-white/[0.06]">
        <button
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-gray-300 text-xs font-bold transition-all"
        >
          <SvgIcon d={ICONS.close} className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
        >
          <SvgIcon d={ICONS.save} className="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  );
};

export default DownloadPageManager;