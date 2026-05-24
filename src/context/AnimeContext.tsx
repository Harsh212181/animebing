 // src/context/AnimeContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../types';
import { getAnimePaginated, searchAnime, getFeaturedAnime } from '../../services/animeService';

interface AnimeContextType {
  animeList: Anime[];
  featuredAnimes: Anime[];
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

const ANIME_FIELDS = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';

// ✅ MODULE-LEVEL CACHE — component re-mount par bhi survive karta hai
// Jab React component unmount/remount hoti hai, yeh variables reset NAHI hote
let _animeListCache: Anime[] = [];
let _featuredCache: Anime[] = [];
let _pageCache = 1;
let _hasMoreCache = true;
let _isSearchingCache = false;

export const AnimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ✅ useState ka initial value cache se — isliye back aane par blank screen nahi
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

  const lastSearchQuery = useRef('');

  // ✅ Cache sync wrappers — state aur module cache dono ek saath update hote hain
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

  // Featured — always fresh
  const fetchFeatured = useCallback(async () => {
    try {
      const data = await getFeaturedAnime();
      if (data?.length) {
        const sliced = data.slice(0, 24);
        _featuredCache = sliced;
        setFeaturedAnimes(sliced);
      }
    } catch (err) {
      console.error('Featured fetch failed', err);
    }
  }, []);

  // Initial load / search
  const loadInitialAnime = useCallback(async (isSearch: boolean = false) => {
    // ✅ Sirf tab loading dikho jab cache bilkul empty ho
    if (_animeListCache.length === 0) setIsLoading(true);
    setError(null);
    const currentSearch = searchQuery;

    try {
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

  // ✅ Initial fetch — sirf tab API call karo jab cache bilkul empty ho
  useEffect(() => {
    if (_animeListCache.length === 0) {
      loadInitialAnime(false);
    }
    if (_featuredCache.length === 0) {
      fetchFeatured();
    }
  }, []);

  // Reload on filter/contentType change
  useEffect(() => {
    if (animeList.length > 0) {
      loadInitialAnime(false);
    }
  }, [filter, contentType]);

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
  }, [searchQuery]);

  return (
    <AnimeContext.Provider
      value={{
        animeList, featuredAnimes, isLoading, error, currentPage, hasMore,
        isLoadingMore, isSearching, filter, contentType, searchQuery,
        loadInitialAnime, loadMoreAnime, fetchFeatured,
        setFilter, setContentType, setSearchQuery,
      }}
    >
      {children}
    </AnimeContext.Provider>
  );
};