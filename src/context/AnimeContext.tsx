// src/context/AnimeContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../types';
import { getAnimePaginated, searchAnime } from '../../services/animeService';

interface AnimeContextType {
  animeList: Anime[];
  featuredAnimes: Anime[];
  featuredSections: { banner: Anime[]; anime: Anime[]; manga: Anime[]; movie: Anime[] };
  sectionVisibility: Record<string, boolean>;
  featuredSectionsLoading: boolean;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
  filter: FilterType;
  contentType: ContentTypeFilter;
  searchQuery: string;
  loadInitialAnime: (isSearch?: boolean) => void;
  loadMoreAnime: () => void;
  fetchFeatured: () => void;
  refreshLatest: () => void;
  setFilter: (f: FilterType) => void;
  setContentType: (ct: ContentTypeFilter) => void;
  setSearchQuery: (q: string) => void;
}

const AnimeContext = createContext<AnimeContextType | null>(null);

export const useAnimeContext = () => {
  const ctx = useContext(AnimeContext);
  if (!ctx) throw new Error('useAnimeContext must be inside AnimeProvider');
  return ctx;
};

const ANIME_FIELDS = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList,lastContentAdded';

// Backend base URL (bina /api ke) — same-origin
const API_BASE = '';

// Per-visitor rotation ke liye fixed bucket (0-9), browser me save rehta hai
const getVisitorBucket = (): string => {
  try {
    let v = localStorage.getItem('featBucket');
    if (v === null) {
      v = String(Math.floor(Math.random() * 10));
      localStorage.setItem('featBucket', v);
    }
    return v;
  } catch {
    return '0';
  }
};

// home endpoint ke raw items ko wahi shape do jo getAnimePaginated deta tha
const normalizeAnime = (a: any): Anime => ({
  ...a,
  id: a._id || a.id,
  lastUpdated: a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now(),
  likes: a.likes || 0,
  dislikes: a.dislikes || 0,
});

// MODULE-LEVEL CACHE — component re-mount par bhi survive karta hai
let _animeListCache: Anime[] = [];
let _featuredCache: Anime[] = [];
let _pageCache = 1;
let _hasMoreCache = true;
let _isSearchingCache = false;

export const AnimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [animeList, setAnimeListRaw] = useState<Anime[]>(_animeListCache);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>(_featuredCache);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(_pageCache);
  const [hasMore, setHasMore] = useState(_hasMoreCache);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(_isSearchingCache);
  const [filter, setFilter] = useState<FilterType>('All');
  const [contentType, setContentType] = useState<ContentTypeFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [featuredSections, setFeaturedSections] = useState({
    banner: [] as Anime[], anime: [] as Anime[], manga: [] as Anime[], movie: [] as Anime[]
  });
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
  const [featuredSectionsLoading, setFeaturedSectionsLoading] = useState(true);

  const lastSearchQuery = useRef('');

  // /home ka last successful fetch time
  const lastSectionsFetchRef = useRef(0);

  // Silent refresh (list) throttle ke liye — last refresh time
  const lastListFetchRef = useRef(Date.now());

  const setAnimeList = useCallback((list: Anime[]) => {
    _animeListCache = list;
    setAnimeListRaw(list);
  }, []);

  const setCurrentPageCached = useCallback((page: number) => {
    _pageCache = page;
    setCurrentPage(page);
  }, []);

  const setHasMoreCached = useCallback((val: boolean) => {
    _hasMoreCache = val;
    setHasMore(val);
  }, []);

  const setIsSearchingCached = useCallback((val: boolean) => {
    _isSearchingCache = val;
    setIsSearching(val);
  }, []);

  // Initial load / search
  const loadInitialAnime = useCallback(async (isSearch: boolean = false) => {
    if (_animeListCache.length === 0) setIsLoading(true);
    setError(null);
    const currentSearch = searchQuery;

    try {
      lastListFetchRef.current = Date.now();
      if (isSearch && currentSearch.trim()) {
        const data = await searchAnime(currentSearch, ANIME_FIELDS);
        const uniqueData = Array.from(
          new Map(data.map((item: Anime) => [item.id || item._id, item])).values()
        );
        setAnimeList(uniqueData);
        setHasMoreCached(false);
        setCurrentPageCached(1);
        setIsSearchingCached(true);
        lastSearchQuery.current = currentSearch;
      } else {
        const data = await getAnimePaginated(1, 36, ANIME_FIELDS);
        const uniqueData = Array.from(
          new Map(data.map((item: Anime) => [item.id || item._id, item])).values()
        );
        setAnimeList(uniqueData);
        setHasMoreCached(uniqueData.length === 36);
        setCurrentPageCached(1);
        setIsSearchingCached(false);
        lastSearchQuery.current = '';
      }
    } catch (err) {
      setError(isSearch ? 'Search failed' : 'Failed to load anime');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, setAnimeList, setHasMoreCached, setCurrentPageCached, setIsSearchingCached]);

  // ✅ NEW — ek hi call: visibility + content/banner/anime/manga/movie + page-1 list
  const fetchHome = useCallback(async (silent: boolean = false) => {
    if (silent && Date.now() - lastSectionsFetchRef.current < 60_000) return; // 60s throttle
    if (!silent) setFeaturedSectionsLoading(true);
    lastSectionsFetchRef.current = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/anime/home?v=${getVisitorBucket()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (!result?.success) throw new Error('Bad /home response');

      if (result.visibility) setSectionVisibility(result.visibility);

      const s = result.sections || {};
      setFeaturedSections(prev => ({
        banner: s.banner ?? prev.banner,
        anime: s.anime ?? prev.anime,
        manga: s.manga ?? prev.manga,
        movie: s.movie ?? prev.movie,
      }));

      // "Latest Content" carousel
      if (Array.isArray(s.content) && s.content.length) {
        const sliced = s.content.slice(0, 24).map(normalizeAnime);
        _featuredCache = sliced;
        setFeaturedAnimes(sliced);
      }

      // Page-1 list (search mode me list ko mat chhedo)
      const fresh: Anime[] = Array.isArray(result.list) ? result.list.map(normalizeAnime) : [];
      if (fresh.length && !_isSearchingCache && !lastSearchQuery.current) {
        lastListFetchRef.current = Date.now();
        if (_animeListCache.length === 0) {
          const uniqueData = Array.from(
            new Map(fresh.map((item: Anime) => [item.id || item._id, item])).values()
          );
          setAnimeList(uniqueData);
          setHasMoreCached(uniqueData.length === 36);
          setCurrentPageCached(1);
          setIsSearchingCached(false);
        } else {
          // silent refresh: naya upar, purana niche
          const freshIds = new Set(fresh.map((a: Anime) => a.id || a._id));
          const rest = _animeListCache.filter(a => !freshIds.has(a.id || a._id));
          setAnimeList([...fresh, ...rest]);
        }
      }
    } catch (err) {
      console.error('Home fetch failed', err);
      // Fallback: purana tareeka, taaki page khali na rahe
      if (_animeListCache.length === 0) loadInitialAnime(false);
    } finally {
      if (!silent) setFeaturedSectionsLoading(false);
    }
  }, [loadInitialAnime, setAnimeList, setHasMoreCached, setCurrentPageCached, setIsSearchingCached]);

  // Ab fetchFeatured bhi /home hi use karta hai (focus pe bar-bar alag call nahi)
  const fetchFeatured = useCallback(() => { fetchHome(true); }, [fetchHome]);

  // Silent refresh — page 1 fresh laao, upar rakho. /home hi list bhi deta hai.
  const refreshLatest = useCallback(() => {
    if (_isSearchingCache || lastSearchQuery.current) return;
    if (Date.now() - lastListFetchRef.current < 60_000) return;
    fetchHome(true);
  }, [fetchHome]);

  // Load more
  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore || isSearching) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getAnimePaginated(nextPage, 24, ANIME_FIELDS);
      const currentIds = new Set(animeList.map(a => a.id || a._id));
      const newUnique = data.filter(a => !currentIds.has(a.id || a._id));
      if (newUnique.length > 0) {
        const merged = [...animeList, ...newUnique];
        setAnimeList(merged);
        setCurrentPageCached(nextPage);
        setHasMoreCached(data.length === 24);
      } else {
        setHasMoreCached(false);
      }
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore, isSearching, animeList, setAnimeList, setCurrentPageCached, setHasMoreCached]);

  // ✅ Initial fetch — ab sirf ek call (/home), list + featured sab usi se
  useEffect(() => {
    fetchHome(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on filter/contentType change
  useEffect(() => {
    if (animeList.length > 0) {
      loadInitialAnime(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, contentType]);

  // Auto-refresh: tab visible ho ya page khula rahe to 5 min me ek baar
  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000;
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSectionsFetchRef.current < REFRESH_MS) return;
      fetchHome(true);
    };
    document.addEventListener('visibilitychange', maybeRefresh);
    const interval = setInterval(maybeRefresh, REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh);
      clearInterval(interval);
    };
  }, [fetchHome]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        if (searchQuery !== lastSearchQuery.current) {
          loadInitialAnime(true);
        }
      } else {
        if (lastSearchQuery.current !== '') {
          loadInitialAnime(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  return (
    <AnimeContext.Provider
      value={{
        animeList, featuredAnimes, featuredSections, sectionVisibility, featuredSectionsLoading,
        isLoading, error, currentPage, hasMore,
        isLoadingMore, isSearching, filter, contentType, searchQuery,
        loadInitialAnime, loadMoreAnime, fetchFeatured, refreshLatest,
        setFilter, setContentType, setSearchQuery,
      }}
    >
      {children}
    </AnimeContext.Provider>
  );
};