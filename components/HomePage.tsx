  // components/HomePage.tsx - FILTER WORKING PERFECTLY
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import { getAnimePaginated, searchAnime, getFeaturedAnime } from '../services/animeService';
import FeaturedAnimeCarousel from '../src/components/FeaturedAnimeCarousel';

interface Props {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  contentType: ContentTypeFilter;
}

const ANIME_FIELDS = 'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';

const HomePage: React.FC<Props> = ({
  onAnimeSelect,
  searchQuery,
  contentType
}) => {
  // Local filter state
  const [localFilter, setLocalFilter] = useState<FilterType>('All');
  
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch featured animes
  const fetchFeaturedAnimes = useCallback(async () => {
    try {
      const data = await getFeaturedAnime();
      if (data && data.length > 0) {
        const limited = data.slice(0, 10);
        setFeaturedAnimes(limited);
        localStorage.setItem('featuredAnimes', JSON.stringify(limited));
      }
    } catch {
      const stored = localStorage.getItem('featuredAnimes');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setFeaturedAnimes(parsed.slice(0, 10));
        } catch {}
      }
    }
  }, []);

  // Dynamic heading
  const getAllContentHeading = useCallback(() => {
    if (contentType !== 'All') return `All ${contentType}`;
    switch (localFilter) {
      case 'Hindi Dub': return 'All Hindi Dub';
      case 'Hindi Sub': return 'All Hindi Sub';
      case 'English Sub': return 'All English Sub';
      default: return 'All Content';
    }
  }, [localFilter, contentType]);

  // Load initial anime
  const loadInitialAnime = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAnimePaginated(1, 36, ANIME_FIELDS);
      if (data?.length) {
        setAnimeList(data);
        setHasMore(data.length === 36);
        setCurrentPage(1);
      } else {
        setError('No anime found');
      }
    } catch {
      setError('Failed to load anime');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load more
  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getAnimePaginated(nextPage, 24, ANIME_FIELDS);
      if (data?.length) {
        setAnimeList(prev => [...prev, ...data]);
        setCurrentPage(nextPage);
        setHasMore(data.length === 24);
      } else {
        setHasMore(false);
      }
    } catch {}
    finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore]);

  // Initial load
  useEffect(() => {
    loadInitialAnime();
    fetchFeaturedAnimes();
  }, []);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim()) return;
    
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchAnime(searchQuery, ANIME_FIELDS);
        setAnimeList(data || []);
        setFeaturedAnimes([]);
        setHasMore(false);
      } catch {
        setError('Search failed');
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter logic
  const filteredAnime = useMemo(() => {
    let list = [...animeList];
    
    if (contentType !== 'All') {
      list = list.filter(a => a.contentType === contentType);
    }
    if (localFilter !== 'All') {
      list = list.filter(a => a.subDubStatus === localFilter);
    }
    
    return list;
  }, [animeList, localFilter, contentType]);

  // Filter buttons
  const filterButtons = [
    { key: 'All' as FilterType, label: 'All' },
    { key: 'Hindi Dub' as FilterType, label: 'Hindi Dub' },
    { key: 'Hindi Sub' as FilterType, label: 'Hindi Sub' },
    { key: 'English Sub' as FilterType, label: 'English Sub' }
  ];

  // Filter change
  const handleFilterChange = (newFilter: FilterType) => {
    setLocalFilter(newFilter);
  };

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        if (!isLoadingMore && hasMore && !searchQuery) loadMoreAnime();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, searchQuery, loadMoreAnime]);

  // Loading state
  if (isLoading && animeList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => <SkeletonLoader key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center bg-slate-800/80 backdrop-blur rounded-2xl p-8 border border-slate-700">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-4 lg:py-8">

        {/* Featured Carousel */}
        {!searchQuery && featuredAnimes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
              Latest Content
            </h2>
            <FeaturedAnimeCarousel featuredAnimes={featuredAnimes} onAnimeSelect={onAnimeSelect} />
          </div>
        )}

        {/* MOBILE FILTER BUTTONS */}
        <div className="mb-3 lg:hidden">
          <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1.5 scrollbar-hide">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => handleFilterChange(btn.key)}
                className={`
                  px-2.5 py-1.5 rounded text-[11px] font-medium transition-all duration-200
                  border whitespace-nowrap flex-shrink-0
                  min-w-[62px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900
                  ${localFilter === btn.key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-md'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700/90'
                  }
                `}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        {filteredAnime.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-10 max-w-md mx-auto border border-slate-700">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {searchQuery ? 'No Results Found' : 'No Content'}
              </h2>
              {localFilter !== 'All' && (
                <button
                  onClick={() => handleFilterChange('All')}
                  className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-xl font-bold"
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-6">
              {getAllContentHeading()}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredAnime.map((anime, i) => (
                <AnimeCard
                  key={anime.id || anime._id}
                  anime={anime}
                  onClick={onAnimeSelect}
                  index={i}
                  showStatus={true}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && !searchQuery && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMoreAnime}
                  disabled={isLoadingMore}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl disabled:opacity-60"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {isLoadingMore && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mt-6">
                {Array.from({ length: 12 }).map((_, i) => <SkeletonLoader key={i} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;
