 // src/components/admin/FeaturedAnimeManager.tsx – Premium UI, no emojis
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Anime } from '../../types';

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev';

type SectionType = 'banner' | 'anime' | 'manga' | 'movie';

const SECTIONS: { key: SectionType; label: string; contentType: string[] | null }[] = [
  { key: 'banner', label: 'Banner Slider', contentType: null },
  { key: 'anime',  label: 'Latest Anime',  contentType: ['Anime', 'Ai Anime', 'Web Series'] },
  { key: 'manga',  label: 'Latest Manga',  contentType: ['Manga', 'Ai Manhwa'] },
  { key: 'movie',  label: 'Latest Movie',  contentType: ['Movie', 'Hollywood Movie', 'Bollywood Movie'] },
];

interface FeaturedAnimeManagerProps {}

// ── Icon primitive ───────────────────────────────────────────────────
const SvgIcon: React.FC<{ d: string; className?: string; fill?: boolean }> = ({ d, className = 'w-4 h-4', fill = false }) => (
  <svg className={className} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  star:       'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  search:     'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh:    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  plus:       'M12 4v16m8-8H4',
  close:      'M6 18L18 6M6 6l12 12',
  check:      'M5 13l4 4L19 7',
  drag:       'M4 8h16M4 16h16',
  up:         'M5 15l7-7 7 7',
  down:       'M19 9l-7 7-7-7',
  eye:        'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:     'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  lightning:  'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  info:       'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  empty:      'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
};

const getOptimizedImageUrl = (url: string | undefined, width: number, height: number): string => {
  if (!url) return 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop';
  let cleanUrl = url.replace(/w-(\d+)/, 'w=$1').replace(/h-(\d+)/, 'h=$1');
  if (cleanUrl.includes('unsplash.com')) {
    const baseUrl = cleanUrl.split('?')[0];
    return `${baseUrl}?w=${width}&h=${height}&fit=crop&auto=format`;
  }
  if (cleanUrl.includes('cloudinary.com')) {
    try {
      const baseUrl = cleanUrl.split('/upload/')[0];
      const rest = cleanUrl.split('/upload/')[1];
      const imagePath = rest.split('/').slice(1).join('/');
      return `${baseUrl}/upload/f_webp,q_auto:good,w_${width},h_${height},c_fill/${imagePath}`;
    } catch {
      return cleanUrl;
    }
  }
  return cleanUrl;
};

const getAdminToken = (): string | null => {
  return localStorage.getItem('adminToken') || localStorage.getItem('token');
};

const FeaturedAnimeManager: React.FC<FeaturedAnimeManagerProps> = () => {
  const [allAnimes, setAllAnimes] = useState<Anime[]>([]);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiStatus, setApiStatus] = useState<string>('Checking API...');
  const [forceRefresh, setForceRefresh] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionType>('banner');

  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueWrite = useCallback((task: () => Promise<void>) => {
    writeQueueRef.current = writeQueueRef.current.then(task).catch((err) => {
      console.error('Queued write failed:', err);
    });
    return writeQueueRef.current;
  }, []);

  const fetchRequestIdRef = useRef(0);

  const markPending = (id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
  const clearPending = (id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    fetchAnimes();
    fetchFeaturedAnimes(activeSection);
    fetchSectionVisibility();
    setDragIndex(null);
    setDragOverIndex(null);
  }, [forceRefresh, activeSection]);

  const fetchSectionVisibility = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/anime/settings/section-visibility`);
      const json = await res.json();
      if (json.success) setSectionVisibility(json.data);
    } catch (err) {
      console.error('Failed to fetch section visibility', err);
    }
  };

  const toggleSectionVisibility = async (section: SectionType) => {
    const currentlyHidden = sectionVisibility[section] ?? false;
    const token = getAdminToken();
    try {
      const res = await fetch(`${API_BASE}/api/anime/settings/section-visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ section, hidden: !currentlyHidden })
      });
      if (res.ok) {
        setSectionVisibility(prev => ({ ...prev, [section]: !currentlyHidden }));
      }
    } catch (err) {
      console.error('Error toggling visibility', err);
    }
  };

  const fetchAnimes = async (): Promise<void> => {
    setApiStatus('Fetching animes...');
    setLoading(true);
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;
    try {
      const endpointBuilders = [
        (page: number) => `${API_BASE}/api/anime?limit=${PAGE_SIZE}&page=${page}`,
        (page: number) => `${API_BASE}/api/animes?limit=${PAGE_SIZE}&page=${page}`,
      ];

      const extractArray = (result: any): Anime[] | null => {
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result?.animes)) return result.animes;
        if (Array.isArray(result?.content)) return result.content;
        return null;
      };

      for (const buildEndpoint of endpointBuilders) {
        try {
          let allFetched: Anime[] = [];
          let page = 1;
          let keepGoing = true;

          while (keepGoing && page <= MAX_PAGES) {
            setApiStatus(`Fetching animes... (${allFetched.length} loaded)`);
            const response = await fetch(buildEndpoint(page));
            if (!response.ok) break;
            const result = await response.json();
            const pageItems = extractArray(result);
            if (!pageItems || pageItems.length === 0) break;

            allFetched = allFetched.concat(pageItems);
            keepGoing = pageItems.length === PAGE_SIZE;
            page++;
          }

          if (allFetched.length > 0) {
            const seen = new Set<string>();
            const deduped = allFetched.filter(a => {
              const id = a._id || a.id || '';
              if (!id) return true;
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            setAllAnimes(deduped);
            localStorage.setItem('animeList', JSON.stringify(deduped));
            setApiStatus(`Loaded ${deduped.length} animes`);
            return;
          }
        } catch (error) {
          console.log(`Failed with endpoint builder:`, error);
        }
      }
      const stored = localStorage.getItem('animeList');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllAnimes(parsed);
          setApiStatus(`Loaded ${parsed.length} animes from cache`);
          return;
        }
      }
      const sampleData = getSampleAnimes();
      setAllAnimes(sampleData);
      localStorage.setItem('animeList', JSON.stringify(sampleData));
      setApiStatus('Using sample data');
    } catch (error) {
      console.error('Error fetching animes:', error);
      setApiStatus('Error loading animes');
    } finally {
      setLoading(false);
    }
  };

  const getSampleAnimes = (): Anime[] => {
    return [
      { id: '1', _id: '1', title: 'Death Note', thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop', releaseYear: 2006, subDubStatus: 'Hindi Dub', contentType: 'Anime', description: 'A high school student discovers a supernatural notebook.', genreList: ['Psychological', 'Thriller'] },
      { id: '2', _id: '2', title: 'Naruto', thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop', releaseYear: 2002, subDubStatus: 'Hindi Sub', contentType: 'Anime', description: 'A young ninja seeks recognition.', genreList: ['Action', 'Adventure'] },
      { id: '3', _id: '3', title: 'Attack on Titan', thumbnail: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=600&fit=crop', releaseYear: 2013, subDubStatus: 'English Sub', contentType: 'Anime', description: 'Humanity fights for survival.', genreList: ['Action', 'Dark Fantasy'] },
      { id: '4', _id: '4', title: 'One Piece', thumbnail: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=400&h=600&fit=crop', releaseYear: 1999, subDubStatus: 'Hindi Dub', contentType: 'Anime', description: 'Pirate crew explores the Grand Line.', genreList: ['Action', 'Adventure'] },
      { id: '5', _id: '5', title: 'Demon Slayer', thumbnail: 'https://images.unsplash.com/photo-1511984804822-e16ba72fcf0a?w=400&h=600&fit=crop', releaseYear: 2019, subDubStatus: 'Hindi Sub', contentType: 'Anime', description: 'A young boy becomes a demon slayer.', genreList: ['Action', 'Supernatural'] },
      { id: '6', _id: '6', title: 'My Hero Academia', thumbnail: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=600&fit=crop', releaseYear: 2016, subDubStatus: 'English Sub', contentType: 'Anime', description: 'A boy without powers dreams of becoming a hero.', genreList: ['Action', 'Superhero'] }
    ];
  };

  const fetchFeaturedAnimes = async (section: SectionType): Promise<void> => {
    const requestId = ++fetchRequestIdRef.current;
    try {
      const endpoints = [
        `${API_BASE}/api/anime/featured`,
        `${API_BASE}/api/featured`,
      ];
      let fetchedFeatured: Anime[] = [];
      for (const endpoint of endpoints) {
        try {
          const url = new URL(endpoint);
          url.searchParams.set('section', section);
          url.searchParams.set('_', Date.now().toString());
          const response = await fetch(url.toString());
          if (!response.ok) continue;
          const result = await response.json();
          if (Array.isArray(result)) fetchedFeatured = result;
          else if (result.data) fetchedFeatured = result.data;
          else if (result.featured) fetchedFeatured = result.featured;
          if (fetchedFeatured.length > 0) {
            if (requestId !== fetchRequestIdRef.current) return;
            setFeaturedAnimes(fetchedFeatured);
            localStorage.setItem(`featuredAnimes_${section}`, JSON.stringify(fetchedFeatured));
            return;
          }
        } catch (error) {
          console.log(`Featured failed with ${endpoint}:`, error);
        }
      }
      if (requestId !== fetchRequestIdRef.current) return;
      const stored = localStorage.getItem(`featuredAnimes_${section}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFeaturedAnimes(parsed);
          return;
        }
      }
      setFeaturedAnimes([]);
    } catch (error) {
      console.error('Error fetching featured animes:', error);
      if (requestId === fetchRequestIdRef.current) setFeaturedAnimes([]);
    }
  };

  const getAnimeId = (anime: Anime): string => anime._id || anime.id || '';

  const addToFeatured = (anime: Anime): void => {
    const animeId = getAnimeId(anime);
    if (!animeId || pendingIds.has(animeId)) return;

    let wasAlreadyFeatured = false;
    setFeaturedAnimes(prev => {
      wasAlreadyFeatured = prev.some(feat => getAnimeId(feat) === animeId);
      if (wasAlreadyFeatured) return prev;
      const updated = [...prev, { ...anime, isFeatured: true, featuredOrder: prev.length + 1 }];
      localStorage.setItem(`featuredAnimes_${activeSection}`, JSON.stringify(updated));
      return updated;
    });
    if (wasAlreadyFeatured) return;

    const section = activeSection;
    markPending(animeId);
    fetchRequestIdRef.current++;

    enqueueWrite(async () => {
      const token = getAdminToken();
      if (!token) console.warn('No admin token found – changes will only be saved locally.');
      try {
        const response = await fetch(`${API_BASE}/api/anime/${animeId}/featured?section=${section}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        if (response.ok) {
          console.log('Added to featured via API');
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.log(`API call failed (${response.status}): ${errorData.error || 'unknown error'}`);
        }
      } catch (apiError) {
        console.log('API call failed, but stored locally');
      } finally {
        clearPending(animeId);
      }
    });
  };

  const removeFromFeatured = (animeId: string): void => {
    if (!animeId || pendingIds.has(animeId)) return;

    setFeaturedAnimes(prev => {
      const updated = prev.filter(anime => getAnimeId(anime) !== animeId);
      localStorage.setItem(`featuredAnimes_${activeSection}`, JSON.stringify(updated));
      return updated;
    });

    const section = activeSection;
    markPending(animeId);
    fetchRequestIdRef.current++;

    enqueueWrite(async () => {
      const token = getAdminToken();
      if (!token) console.warn('No admin token found – changes will only be saved locally.');
      try {
        const response = await fetch(`${API_BASE}/api/anime/${animeId}/featured?section=${section}`, {
          method: 'DELETE',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        if (response.ok) {
          console.log('Removed from featured via API');
        } else {
          console.log('API call failed, but removed locally');
        }
      } catch (apiError) {
        console.log('API call failed, but removed locally');
      } finally {
        clearPending(animeId);
      }
    });
  };

  const applyReorder = (fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const section = activeSection;
    fetchRequestIdRef.current++;

    let withUpdatedOrder: Anime[] = [];
    setFeaturedAnimes(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      if (!moved) return prev;
      updated.splice(toIndex, 0, moved);
      withUpdatedOrder = updated.map((anime, index) => ({ ...anime, featuredOrder: index + 1 }));
      localStorage.setItem(`featuredAnimes_${section}`, JSON.stringify(withUpdatedOrder));
      return withUpdatedOrder;
    });

    setSavingOrder(true);
    enqueueWrite(async () => {
      const token = getAdminToken();
      try {
        const response = await fetch(`${API_BASE}/api/anime/featured/order`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            order: withUpdatedOrder.map(anime => getAnimeId(anime)),
            section
          }),
        });
        if (response.ok) {
          console.log('Featured order updated via API');
        } else {
          console.log('Order update API failed, but stored locally');
        }
      } catch (error) {
        console.log('Order update API failed, but stored locally');
      } finally {
        setSavingOrder(false);
      }
    });
  };

  const reorderFeatured = (fromIndex: number, toIndex: number): void => applyReorder(fromIndex, toIndex);

  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
  };
  const handleDragEnter = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex === null || index === dragIndex) return;
    setDragOverIndex(index);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) applyReorder(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const filteredAnimes = allAnimes.filter(anime => {
    if (!anime.title) return false;
    const sectionMeta = SECTIONS.find(s => s.key === activeSection);
    if (sectionMeta?.contentType && !sectionMeta.contentType.includes(anime.contentType)) return false;
    const animeId = getAnimeId(anime);
    const isFeatured = featuredAnimes.some(featured => getAnimeId(featured) === animeId);
    if (isFeatured) return false;
    if (searchTerm.trim()) {
      return anime.title.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`featuredAnimes_${activeSection}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFeaturedAnimes(parsed);
        }
      }
    } catch (error) {
      console.log('No stored featured animes found');
    }
  }, [activeSection]);

  const handleForceRefresh = () => {
    setForceRefresh(prev => prev + 1);
    setSearchTerm('');
  };

  const sectionMeta = SECTIONS.find(s => s.key === activeSection);
  const totalContent = activeSection === 'banner'
    ? allAnimes.length
    : allAnimes.filter(a => (sectionMeta?.contentType || []).includes(a.contentType)).length;

  const getApiStatusColor = () => {
    if (apiStatus.toLowerCase().includes('error')) return { bg: 'bg-rose-500/15', text: 'text-rose-300', ring: 'border-rose-500/25' };
    if (apiStatus.toLowerCase().includes('sample') || apiStatus.toLowerCase().includes('fetching')) return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'border-amber-500/25' };
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'border-emerald-500/25' };
  };
  const apiColors = getApiStatusColor();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0b0a14]">
        <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="mt-3 text-xs text-gray-500 font-medium">Loading anime collection...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 min-h-screen bg-[#0b0a14] text-white">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <SvgIcon d={ICONS.star} className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Featured Manager</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage homepage carousel & sections</p>
          </div>
        </div>

        {(pendingIds.size > 0 || savingOrder) && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-300 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* ─── Section Tabs ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2">
        {SECTIONS.map(sec => {
          const isHidden = sectionVisibility[sec.key] ?? false;
          const isActive = activeSection === sec.key;
          return (
            <div
              key={sec.key}
              className={`flex items-stretch rounded-xl overflow-hidden border transition-all duration-200 ${
                isActive ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <button
                onClick={() => setActiveSection(sec.key)}
                className={`px-3.5 py-2 text-xs font-bold tracking-tight transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {sec.label}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(sec.key); }}
                title={isHidden ? 'Hidden on site — click to show' : 'Visible on site — click to hide'}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider border-l transition-all duration-200 ${
                  isActive ? 'border-white/10' : 'border-white/[0.06]'
                } ${
                  isHidden
                    ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isHidden ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                {isHidden ? 'Hidden' : 'Live'}
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── Stats Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Content */}
        <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-amber-500/15">
              <SvgIcon d={ICONS.star} className="w-4 h-4 text-amber-300" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{totalContent}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1">
            Total {activeSection === 'banner' ? 'Content' : sectionMeta?.label}
          </p>
        </div>

        {/* Featured */}
        <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-orange-500/15">
              <SvgIcon d={ICONS.star} className="w-4 h-4 text-orange-300" />
            </div>
            <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 rounded-md">
              / 24
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{featuredAnimes.length}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1">
            Featured {activeSection}
          </p>
        </div>

        {/* API Status */}
        <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${apiColors.bg}`}>
              <SvgIcon d={ICONS.lightning} className={`w-4 h-4 ${apiColors.text}`} />
            </div>
          </div>
          <p className={`text-xs font-bold ${apiColors.text} truncate`}>{apiStatus}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1">API Status</p>
        </div>
      </div>

      {/* ─── Current Featured ─────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-1 h-4 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
            {sectionMeta?.label} Featured
          </h2>
          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-md">
            {featuredAnimes.length}
          </span>
          {featuredAnimes.length > 1 && (
            <span className="text-[10px] text-gray-500 flex items-center gap-1 ml-auto">
              <SvgIcon d={ICONS.drag} className="w-3 h-3" />
              Drag to reorder
            </span>
          )}
        </div>

        {featuredAnimes.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <SvgIcon d={ICONS.star} className="w-7 h-7 text-amber-500/30" />
            </div>
            <h3 className="text-sm font-bold text-gray-300">This section is empty</h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto">
              Nothing is featured yet. Pick items from the library below.
            </p>
            <button
              onClick={() => document.getElementById('add-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
            >
              Browse library
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
            {featuredAnimes.map((anime, index) => {
              const imgWidth = 160;
              const imgHeight = 240;
              const optimizedSrc = getOptimizedImageUrl(anime.thumbnail, imgWidth, imgHeight);
              const animeId = getAnimeId(anime);
              const isPending = pendingIds.has(animeId);
              const isDragging = dragIndex === index;
              const isDragOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
              return (
                <div
                  key={animeId}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragEnter={handleDragEnter(index)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`group relative bg-white/[0.03] border rounded-xl overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing ${
                    isDragOver
                      ? 'border-amber-400 ring-2 ring-amber-400/40 scale-[1.03]'
                      : 'border-white/[0.06] hover:border-amber-500/40 hover:-translate-y-0.5'
                  } ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                >
                  {/* Rank badge */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <div className="px-1.5 py-0.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-md text-[9px] font-bold tracking-wide shadow-lg">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Drag hint */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-70 transition-opacity">
                    <SvgIcon d={ICONS.drag} className="w-3 h-3 text-white" />
                  </div>

                  {/* Image */}
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img
                      src={optimizedSrc}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      width={imgWidth}
                      height={imgHeight}
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.src = getOptimizedImageUrl(anime.thumbnail || '', 160, 240);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {isPending && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Action buttons overlay (top-right) */}
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {index > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); reorderFeatured(index, index - 1); }}
                          disabled={isPending}
                          className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-amber-600 backdrop-blur-sm rounded-md text-white/80 hover:text-white transition-all disabled:opacity-40"
                          title="Move up"
                        >
                          <SvgIcon d={ICONS.up} className="w-3 h-3" />
                        </button>
                      )}
                      {index < featuredAnimes.length - 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); reorderFeatured(index, index + 1); }}
                          disabled={isPending}
                          className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-amber-600 backdrop-blur-sm rounded-md text-white/80 hover:text-white transition-all disabled:opacity-40"
                          title="Move down"
                        >
                          <SvgIcon d={ICONS.down} className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromFeatured(animeId); }}
                        disabled={isPending}
                        className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-rose-600 backdrop-blur-sm rounded-md text-white/80 hover:text-white transition-all disabled:opacity-40"
                        title="Remove"
                      >
                        <SvgIcon d={ICONS.close} className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="p-2">
                    <h3 className="font-bold text-white text-[11px] leading-snug truncate" title={anime.title}>
                      {anime.title}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-500 text-[9px] font-medium tabular-nums">
                        {anime.releaseYear || 'N/A'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                        anime.subDubStatus?.includes('Dub')
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                      }`}>
                        {anime.subDubStatus?.includes('Dub') ? 'Dub' : 'Sub'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Add Section ─────────────────────────────── */}
      <div id="add-section" className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Add {activeSection === 'banner' ? 'Content' : sectionMeta?.label} to Featured
          </h2>
        </div>

        {/* Search + Actions */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <SvgIcon d={ICONS.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder={`Search ${activeSection === 'banner' ? 'all content' : activeSection} by title...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 outline-none transition-all focus:border-amber-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-amber-500/20"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <SvgIcon d={ICONS.close} className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleForceRefresh}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-gray-300 hover:text-white text-xs font-bold transition-all"
            >
              <SvgIcon d={ICONS.refresh} className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => {
                const sampleData = getSampleAnimes();
                setAllAnimes(sampleData);
                localStorage.setItem('animeList', JSON.stringify(sampleData));
                setApiStatus(`Loaded sample data`);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/[0.04] hover:bg-emerald-500/15 border border-white/[0.08] hover:border-emerald-500/25 rounded-xl text-gray-300 hover:text-emerald-300 text-xs font-bold transition-all"
            >
              <SvgIcon d={ICONS.plus} className="w-3.5 h-3.5" />
              Sample
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-full text-gray-400 font-medium">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            {activeSection === 'banner' ? 'All Content' : sectionMeta?.label}:
            <span className="text-white font-bold">{totalContent}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-full text-gray-400 font-medium">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
            Featured:
            <span className="text-white font-bold">{featuredAnimes.length}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-full text-gray-400 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            Available:
            <span className="text-white font-bold">{filteredAnimes.length}</span>
          </span>
        </div>

        {/* Content grid */}
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
            {filteredAnimes.map(anime => {
              const imgWidth = 160;
              const imgHeight = 240;
              const optimizedSrc = getOptimizedImageUrl(anime.thumbnail, imgWidth, imgHeight);
              const animeId = getAnimeId(anime);
              const isPending = pendingIds.has(animeId);
              const atMax = featuredAnimes.length >= 24;
              return (
                <div
                  key={animeId}
                  className="group bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-amber-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img
                      src={optimizedSrc}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      width={imgWidth}
                      height={imgHeight}
                      onError={(e) => {
                        e.currentTarget.src = getOptimizedImageUrl(anime.thumbnail || '', 160, 240);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {isPending && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${
                        anime.subDubStatus?.includes('Dub')
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {anime.subDubStatus?.includes('Dub') ? 'Dub' : 'Sub'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 space-y-1.5">
                    <h3 className="font-bold text-white text-[11px] leading-snug truncate" title={anime.title}>
                      {anime.title}
                    </h3>
                    <button
                      onClick={() => addToFeatured(anime)}
                      disabled={atMax || isPending}
                      className={`w-full inline-flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                        atMax || isPending
                          ? 'bg-white/[0.04] text-gray-500 cursor-not-allowed border border-white/[0.06]'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30'
                      }`}
                    >
                      {atMax ? (
                        <>
                          <SvgIcon d={ICONS.info} className="w-3 h-3" />
                          Max
                        </>
                      ) : (
                        <>
                          <SvgIcon d={ICONS.plus} className="w-3 h-3" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <SvgIcon
                d={searchTerm || allAnimes.length === 0 ? ICONS.search : ICONS.check}
                className={`w-7 h-7 ${searchTerm || allAnimes.length === 0 ? 'text-amber-500/40' : 'text-emerald-500/50'}`}
              />
            </div>
            <h3 className="text-sm font-bold text-gray-300">
              {searchTerm ? 'No matches found' : allAnimes.length === 0 ? 'No content available' : `Every item is already featured`}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto">
              {searchTerm
                ? <>Nothing matches <span className="text-white font-semibold">"{searchTerm}"</span> — try a different title.</>
                : allAnimes.length === 0
                ? 'Your database is empty. Load sample data or refresh to try again.'
                : `You've featured everything available in this section.`}
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-gray-300 hover:text-white text-xs font-bold transition-all"
                >
                  Clear search
                </button>
              )}
              <button
                onClick={handleForceRefresh}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedAnimeManager;