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

export const AnimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState<FilterType>('All');
  const [contentType, setContentType] = useState<ContentTypeFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const lastSearchQuery = useRef('');

  // Featured – always fresh
  const fetchFeatured = useCallback(async () => {
    try {
      const data = await getFeaturedAnime();
      if (data?.length) setFeaturedAnimes(data.slice(0, 24));
    } catch (err) {
      console.error('Featured fetch failed', err);
    }
  }, []);

  // Initial load / search
  const loadInitialAnime = useCallback(async (isSearch: boolean = false) => {
    if (animeList.length === 0) setIsLoading(true);
    setError(null);
    const currentSearch = searchQuery;

    try {
      if (isSearch && currentSearch.trim()) {
        const data = await searchAnime(currentSearch, ANIME_FIELDS);
        const uniqueData = Array.from(
          new Map(data.map((item: Anime) => [item.id || item._id, item])).values()
        );
        setAnimeList(uniqueData);
        setHasMore(false);
        setCurrentPage(1);
        setIsSearching(true);
        lastSearchQuery.current = currentSearch;
      } else {
        const data = await getAnimePaginated(1, 36, ANIME_FIELDS);
        const uniqueData = Array.from(
          new Map(data.map((item: Anime) => [item.id || item._id, item])).values()
        );
        setAnimeList(uniqueData);
        setHasMore(uniqueData.length === 36);
        setCurrentPage(1);
        setIsSearching(false);
        lastSearchQuery.current = '';
      }
    } catch (err) {
      setError(isSearch ? 'Search failed' : 'Failed to load anime');
    } finally {
      setIsLoading(false);
    }
  }, [animeList.length, searchQuery]);

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
        setAnimeList(prev => [...prev, ...newUnique]);
        setCurrentPage(nextPage);
        setHasMore(data.length === 24);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore, isSearching, animeList]);

  // Initial fetch
  useEffect(() => {
    loadInitialAnime(false);
    fetchFeatured();
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