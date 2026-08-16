 // src/components/admin/FeaturedAnimeManager.tsx – BANNER + SECTIONS VERSION + HIDE/SHOW TOGGLES
// FIXED: race condition on rapid add/remove clicks, added drag & drop reordering, improved UI
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

  // ── Section visibility state ──
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});

  // ── NEW: per-item "in flight" lock so rapid double clicks on the SAME card are ignored ──
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // ── NEW: drag & drop state ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // ── NEW: a strictly-ordered queue for backend writes so rapid add/remove/reorder
  // calls never land out of order and never stomp on each other. Every mutation is
  // pushed onto this promise chain instead of firing independently. ──
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueWrite = useCallback((task: () => Promise<void>) => {
    writeQueueRef.current = writeQueueRef.current.then(task).catch((err) => {
      console.error('Queued write failed:', err);
    });
    return writeQueueRef.current;
  }, []);

  // ── NEW: guards against a slow/late fetchFeaturedAnimes response overwriting
  // newer local state (this was the root cause of removed items "coming back"). ──
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
    // Reset drag state and clear the write queue's "logical" state when switching tabs
    setDragIndex(null);
    setDragOverIndex(null);
  }, [forceRefresh, activeSection]);

  // ── Fetch section hide/show flags from backend ──
  const fetchSectionVisibility = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/anime/settings/section-visibility`);
      const json = await res.json();
      if (json.success) setSectionVisibility(json.data);
    } catch (err) {
      console.error('Failed to fetch section visibility', err);
    }
  };

  // ── Toggle a single section visibility ──
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

  // ── FIXED: previously fetched a single page with a hardcoded limit=100,
  // so anything beyond the 100th item never loaded. This now pages through
  // results (page=1,2,3…) and keeps merging until the backend returns a
  // page smaller than the page size (i.e. no more data), so all content
  // shows regardless of how many items exist. PAGE_SIZE is kept at 100 per
  // request to match what the backend is known to handle comfortably.
  const fetchAnimes = async (): Promise<void> => {
    setApiStatus('Fetching animes...');
    setLoading(true);
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50; // safety cap so a misbehaving API can't loop forever
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
            // Stop once the backend returns fewer items than we asked for —
            // that means we've reached the last page.
            keepGoing = pageItems.length === PAGE_SIZE;
            page++;
          }

          if (allFetched.length > 0) {
            // De-duplicate in case a paginated endpoint overlaps on the edges
            const seen = new Set<string>();
            const deduped = allFetched.filter(a => {
              const id = a._id || a.id || '';
              if (!id) return true; // no id to dedupe by, keep as-is
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            setAllAnimes(deduped);
            localStorage.setItem('animeList', JSON.stringify(deduped));
            setApiStatus(`✅ Loaded ${deduped.length} animes`);
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
          setApiStatus(`✅ Loaded ${parsed.length} animes from localStorage`);
          return;
        }
      }
      const sampleData = getSampleAnimes();
      setAllAnimes(sampleData);
      localStorage.setItem('animeList', JSON.stringify(sampleData));
      setApiStatus('⚠️ Using sample data (no API connection)');
    } catch (error) {
      console.error('Error fetching animes:', error);
      setApiStatus('❌ Error loading animes');
    } finally {
      setLoading(false);
    }
  };

  const getSampleAnimes = (): Anime[] => {
    return [
      { id: '1', _id: '1', title: 'Death Note', thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop', releaseYear: 2006, subDubStatus: 'Hindi Dub', contentType: 'Anime', description: 'A high school student discovers a supernatural notebook that allows him to kill anyone by writing the victim\'s name.', genreList: ['Psychological', 'Thriller', 'Supernatural'] },
      { id: '2', _id: '2', title: 'Naruto', thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop', releaseYear: 2002, subDubStatus: 'Hindi Sub', contentType: 'Anime', description: 'A young ninja seeks recognition from his peers and dreams of becoming the Hokage.', genreList: ['Action', 'Adventure', 'Fantasy'] },
      { id: '3', _id: '3', title: 'Attack on Titan', thumbnail: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=600&fit=crop', releaseYear: 2013, subDubStatus: 'English Sub', contentType: 'Anime', description: 'Humanity fights for survival against giant humanoid creatures known as Titans.', genreList: ['Action', 'Dark Fantasy', 'Drama'] },
      { id: '4', _id: '4', title: 'One Piece', thumbnail: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=400&h=600&fit=crop', releaseYear: 1999, subDubStatus: 'Hindi Dub', contentType: 'Anime', description: 'Monkey D. Luffy and his pirate crew explore the Grand Line in search of the world\'s ultimate treasure.', genreList: ['Action', 'Adventure', 'Comedy'] },
      { id: '5', _id: '5', title: 'Demon Slayer', thumbnail: 'https://images.unsplash.com/photo-1511984804822-e16ba72fcf0a?w=400&h=600&fit=crop', releaseYear: 2019, subDubStatus: 'Hindi Sub', contentType: 'Anime', description: 'A young boy becomes a demon slayer to avenge his family and cure his sister.', genreList: ['Action', 'Dark Fantasy', 'Supernatural'] },
      { id: '6', _id: '6', title: 'My Hero Academia', thumbnail: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=600&fit=crop', releaseYear: 2016, subDubStatus: 'English Sub', contentType: 'Anime', description: 'A boy without powers in a super-powered world dreams of becoming a hero.', genreList: ['Action', 'Superhero', 'Comedy'] }
    ];
  };

  const fetchFeaturedAnimes = async (section: SectionType): Promise<void> => {
    // Tag this request so a late response from an older request can be discarded
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
            // Discard if a newer fetch (or a local mutation queued after this call
            // started) has already superseded this response.
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

  // ── FIXED: uses functional state updates so it always builds on the latest
  // state instead of a stale closure, and no longer re-fetches from the server
  // after a successful write (that refetch was racing with subsequent clicks and
  // is what caused removed items to "come back"). The backend write itself is
  // pushed onto the sequential queue so out-of-order requests can't happen. ──
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
    // Bump the fetch guard so any in-flight fetchFeaturedAnimes response from
    // before this action can't overwrite the optimistic update above.
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
          console.log('✅ Added to featured via API');
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.log(`⚠️ API call failed (${response.status}): ${errorData.error || 'unknown error'}`);
        }
      } catch (apiError) {
        console.log('⚠️ API call failed, but stored locally');
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
          console.log('✅ Removed from featured via API');
        } else {
          console.log('⚠️ API call failed, but removed locally');
        }
      } catch (apiError) {
        console.log('⚠️ API call failed, but removed locally');
      } finally {
        clearPending(animeId);
      }
    });
  };

  // ── Shared reorder logic used by both the ↑/↓ buttons and drag & drop ──
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
          console.log('✅ Featured order updated via API');
        } else {
          console.log('⚠️ Order update API failed, but stored locally');
        }
      } catch (error) {
        console.log('⚠️ Order update API failed, but stored locally');
      } finally {
        setSavingOrder(false);
      }
    });
  };

  const reorderFeatured = (fromIndex: number, toIndex: number): void => applyReorder(fromIndex, toIndex);

  // ── NEW: Drag & drop handlers ──
  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // some browsers require this to enable dragging; ignore failures
    }
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
    if (dragIndex !== null && dragIndex !== index) {
      applyReorder(dragIndex, index);
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-2xl">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-orange-500/30 border-b-orange-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
        </div>
        <p className="mt-6 text-xl font-semibold text-white/90">Loading Anime Collection</p>
        <p className="mt-2 text-white/60">{apiStatus}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Local keyframes for empty-state motion — scoped, no Tailwind config changes needed */}
      <style>{`
        @keyframes fam-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fam-fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fam-float { animation: fam-float 3.2s ease-in-out infinite; }
        .fam-fade-in-up { animation: fam-fade-in-up 0.35s ease-out; }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
              Featured Anime Manager
            </h1>
            <p className="text-white/50 text-sm mt-1">Manage your homepage carousel & sections</p>
          </div>
        </div>

        {/* NEW: subtle sync indicator so admins can see writes are still catching up */}
        {(pendingIds.size > 0 || savingOrder) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-medium">
            <span className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin"></span>
            Saving changes…
          </div>
        )}
      </div>

      {/* ── Section Tabs + Hide/Show Toggles ── */}
      <div className="flex flex-wrap items-center gap-3 bg-purple-950/30 p-2 rounded-2xl border border-purple-700/30">
        {SECTIONS.map(sec => {
          const isHidden = sectionVisibility[sec.key] ?? false;
          const isActive = activeSection === sec.key;
          return (
            <div
              key={sec.key}
              className={`flex items-stretch rounded-xl overflow-hidden border transition-all duration-200 ${
                isActive ? 'border-amber-500/50 shadow-lg shadow-amber-600/10' : 'border-purple-700/30 hover:border-purple-600/50'
              }`}
            >
              <button
                onClick={() => setActiveSection(sec.key)}
                className={`px-4 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                    : 'bg-purple-900/30 text-white/55 hover:text-white hover:bg-purple-800/40'
                }`}
              >
                {sec.label}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSectionVisibility(sec.key);
                }}
                title={isHidden ? 'Hidden on site — click to show' : 'Visible on site — click to hide'}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold tracking-wide border-l transition-all duration-200 ${
                  isActive ? 'border-white/10' : 'border-purple-700/30'
                } ${
                  isHidden
                    ? 'bg-rose-950/50 text-rose-300 hover:bg-rose-900/60'
                    : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isHidden ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                {isHidden ? 'Hidden' : 'Live'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 rounded-lg">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 6v.878m13.5 0A2.25 2.25 0 0119.5 6v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 9v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V9a2.25 2.25 0 012.25-2.25V6.878" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">Total {SECTIONS.find(s => s.key === activeSection)?.contentType 
              ? SECTIONS.find(s => s.key === activeSection)?.label 
              : 'All Content'}</p>
            <p className="text-2xl font-bold text-white">
              {activeSection === 'banner'
                ? allAnimes.length
                : allAnimes.filter(a => (SECTIONS.find(s => s.key === activeSection)?.contentType || []).includes(a.contentType)).length
              }
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">Featured {activeSection}</p>
            <p className="text-2xl font-bold text-white">{featuredAnimes.length} <span className="text-sm font-normal text-white/40">/ 24</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl p-5 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${
            apiStatus.includes('✅') ? 'bg-emerald-500/20' : 
            apiStatus.includes('❌') ? 'bg-rose-500/20' : 
            'bg-amber-500/20'
          }`}>
            <svg className={`w-6 h-6 ${
              apiStatus.includes('✅') ? 'text-emerald-400' : 
              apiStatus.includes('❌') ? 'text-rose-400' : 
              'text-amber-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <p className="text-white/50 text-xs">API Status</p>
            <p className={`text-sm font-medium ${
              apiStatus.includes('✅') ? 'text-emerald-400' : 
              apiStatus.includes('❌') ? 'text-rose-400' : 
              'text-amber-400'
            }`}>
              {apiStatus}
            </p>
          </div>
        </div>
      </div>

      {/* Current Featured Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-1.5 h-7 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full"></span>
          <h2 className="text-xl font-bold text-white/90">{activeSection} Featured Collection</h2>
          <span className="text-sm text-white/50 bg-white/5 px-3 py-1 rounded-full">
            {featuredAnimes.length} items
          </span>
          {featuredAnimes.length > 1 && (
            <span className="text-xs text-white/40 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
              </svg>
              Drag cards to reorder
            </span>
          )}
        </div>

        {featuredAnimes.length === 0 ? (
          <div className="fam-fade-in-up text-center py-14 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-dashed border-purple-700/50 rounded-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl"></div>
              <svg className="fam-float relative w-16 h-16 mx-auto mt-2 text-amber-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white/85">
              This section is empty
            </h3>
            <p className="mt-1.5 text-white/50 text-sm max-w-md mx-auto leading-relaxed">
              Nothing is featured in <span className="text-white/70 font-medium">{activeSection === 'banner' ? 'the banner slider' : activeSection}</span> yet. Pick items from the library below to feature them here.
            </p>
            <button
              onClick={() => document.getElementById('add-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-6 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-amber-600/20 transition-all duration-200 hover:shadow-amber-600/40 hover:-translate-y-0.5"
            >
              Browse the library
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
                  className={`group relative bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border rounded-xl overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 ${
                    isDragOver
                      ? 'border-amber-400 ring-2 ring-amber-400/60 scale-[1.03]'
                      : 'border-purple-700/40 hover:border-amber-500/50'
                  } ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
                    <div className="px-1.5 py-0.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full text-[9px] font-bold tracking-wide shadow-lg">
                      #{index + 1}
                    </div>
                  </div>
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-70 transition-opacity">
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>
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
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                    {isPending && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      </div>
                    )}
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      {index > 0 && (
                        <button
                          onClick={() => reorderFeatured(index, index - 1)}
                          disabled={isPending}
                          className="w-5 h-5 flex items-center justify-center bg-purple-900/80 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-purple-900/80 rounded-md text-white/80 hover:text-white text-[10px] transition-all"
                          title="Move up"
                        >
                          ↑
                        </button>
                      )}
                      {index < featuredAnimes.length - 1 && (
                        <button
                          onClick={() => reorderFeatured(index, index + 1)}
                          disabled={isPending}
                          className="w-5 h-5 flex items-center justify-center bg-purple-900/80 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-purple-900/80 rounded-md text-white/80 hover:text-white text-[10px] transition-all"
                          title="Move down"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => removeFromFeatured(animeId)}
                        disabled={isPending}
                        className="w-5 h-5 flex items-center justify-center bg-purple-900/80 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-purple-900/80 rounded-md text-white/80 hover:text-white text-[10px] transition-all"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="px-2 py-2 border-t border-purple-800/30">
                    <h3 className="font-semibold text-white text-[12px] leading-snug truncate" title={anime.title}>
                      {anime.title}
                    </h3>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-white/45 text-[10px] font-medium tabular-nums">{anime.releaseYear || 'N/A'}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold tracking-wider uppercase ${
                        anime.subDubStatus?.includes('Dub') 
                          ? 'bg-emerald-500/15 text-emerald-300' 
                          : 'bg-amber-500/15 text-amber-300'
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

      {/* Add Anime Section */}
      <div id="add-section" className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full"></span>
          <h2 className="text-xl font-bold text-white/90">
            Add {activeSection === 'banner' ? 'Content' : activeSection} to Featured
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-white/40 group-focus-within:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={`Search ${activeSection === 'banner' ? 'all content' : activeSection} by title...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-purple-800/40 border border-purple-700/50 rounded-xl text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="w-5 h-5 text-white/40 hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleForceRefresh}
              className="px-5 py-3 bg-purple-800/40 hover:bg-amber-500/20 border border-purple-700/50 hover:border-amber-500/50 rounded-xl text-white/80 hover:text-amber-300 text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => {
                const sampleData = getSampleAnimes();
                setAllAnimes(sampleData);
                localStorage.setItem('animeList', JSON.stringify(sampleData));
                setApiStatus('✅ Loaded sample data for testing');
              }}
              className="px-5 py-3 bg-purple-800/40 hover:bg-emerald-500/20 border border-purple-700/50 hover:border-emerald-500/50 rounded-xl text-white/80 hover:text-emerald-300 text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Sample Data
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
            {activeSection === 'banner' ? 'All Content' : `Total ${SECTIONS.find(s => s.key === activeSection)?.label}`}:
            <span className="text-white font-semibold">
              {activeSection === 'banner'
                ? allAnimes.length
                : allAnimes.filter(a => (SECTIONS.find(s => s.key === activeSection)?.contentType || []).includes(a.contentType)).length
              }
            </span>
          </div>
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
            Featured: <span className="text-white font-semibold">{featuredAnimes.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-purple-800/30 rounded-lg text-white/70 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Available: <span className="text-white font-semibold">{filteredAnimes.length}</span>
          </div>
        </div>

        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
            {filteredAnimes.map(anime => {
              const imgWidth = 160;
              const imgHeight = 240;
              const optimizedSrc = getOptimizedImageUrl(anime.thumbnail, imgWidth, imgHeight);
              const animeId = getAnimeId(anime);
              const isPending = pendingIds.has(animeId);
              return (
                <div
                  key={animeId}
                  className="group bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-purple-700/40 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                    {isPending && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5">
                      <span className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase rounded-md ${
                        anime.subDubStatus?.includes('Dub')
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {anime.subDubStatus?.includes('Dub') ? 'Dub' : 'Sub'}
                      </span>
                    </div>
                  </div>
                  <div className="px-2 py-2 border-t border-purple-800/30">
                    <h3 className="font-medium text-white text-[12px] leading-snug truncate mb-1.5" title={anime.title}>
                      {anime.title}
                    </h3>
                    <button
                      onClick={() => addToFeatured(anime)}
                      disabled={featuredAnimes.length >= 24 || isPending}
                      className={`w-full py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                        featuredAnimes.length >= 24 || isPending
                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg hover:shadow-amber-600/30'
                      }`}
                    >
                      {featuredAnimes.length >= 24 ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Max
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
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
          <div className="fam-fade-in-up text-center py-14 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40 backdrop-blur-sm border border-dashed border-purple-700/50 rounded-2xl">
            <div className="relative w-20 h-20 mx-auto">
              {searchTerm || allAnimes.length === 0 ? (
                <>
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl"></div>
                  <svg className="fam-float relative w-16 h-16 mx-auto mt-2 text-amber-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl"></div>
                  <svg className="fam-float relative w-16 h-16 mx-auto mt-2 text-emerald-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </>
              )}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white/85">
              {searchTerm ? 'No matches found' : allAnimes.length === 0 ? 'No content available' : `Every ${activeSection === 'banner' ? 'item' : activeSection} is already featured`}
            </h3>
            <p className="mt-1.5 text-white/50 text-sm max-w-md mx-auto leading-relaxed">
              {searchTerm ? <>Nothing matches <span className="text-white/70 font-medium">"{searchTerm}"</span> — try a different title.</> : allAnimes.length === 0 ? 'Your database is empty. Load sample data or refresh to try again.' : `You've featured everything available in ${activeSection === 'banner' ? 'content' : activeSection}. Nice and complete.`}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all duration-200"
                >
                  Clear search
                </button>
              )}
              <button
                onClick={handleForceRefresh}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-amber-600/20 hover:shadow-amber-600/40 hover:-translate-y-0.5"
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