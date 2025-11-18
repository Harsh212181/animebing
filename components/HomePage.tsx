 // components/HomePage.tsx - UPDATED WITH MANGA SUPPORT
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import { searchAnime } from '../services/animeService';
import Spinner from './Spinner';
import { SkeletonLoader } from './SkeletonLoader'; // ✅ NAYA IMPORT
import AdSlot from './AdSlot'; // ✅ IMPORT AD SLOT

// Lazy load AnimeCard for better performance
const AnimeCard = lazy(() => import('./AnimeCard'));

const ITEMS_PER_LOAD = 12;

interface HomePageProps {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  filter: FilterType;
  contentType: ContentTypeFilter;
}

const HomePage: React.FC<HomePageProps> = ({ onAnimeSelect, searchQuery, filter, contentType }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_LOAD);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAndSearchAnime = async () => {
      try {
        setIsLoading(true);
        setIsSearching(!!searchQuery.trim());
        setError(null);
        const data = await searchAnime(searchQuery);
        setAnimeList(data);
      } catch (err) {
        setError('Failed to fetch anime data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    };
    
    // Debounce search - 300ms delay
    const timeoutId = setTimeout(fetchAndSearchAnime, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredAnime = useMemo(() => {
    let result = animeList;
  
    // ✅ UPDATED: Handle Manga content type
    if (contentType !== 'All') {
      console.log('🎯 Filtering by content type:', contentType);
      console.log('📊 Total content before filter:', result.length);
  
      result = result.filter(anime => {
        let actualType = anime.contentType;
  
        if (!actualType) {
          // Title se detect karo - more flexible
          const title = anime.title.toLowerCase();
          if (title.includes('movie') || title.includes('film') ||
              title === 'don' || title === 'jk') {
            actualType = 'Movie';
          } else if (title.includes('manga') || title.includes('comic')) { // ✅ NEW: Manga detection
            actualType = 'Manga';
          } else {
            actualType = 'Anime';
          }
        }
  
        const matches = actualType === contentType;
        console.log(`🎬 ${anime.title} - Detected Type: ${actualType} - Matches: ${matches}`);
        return matches;
      });
  
      console.log('📊 Total content after filter:', result.length);
    }
  
    // Filter by sub/dub status (only for Anime/Movie, not Manga)
    if (filter !== 'All' && contentType !== 'Manga') {
      result = result.filter(anime => anime.subDubStatus === filter);
    }
  
    return result;
  }, [animeList, filter, contentType]);

  // Reset display count when filters or search query change
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_LOAD);
  }, [filteredAnime]);

  const hasMore = displayedCount < filteredAnime.length;

  const loadMoreItems = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prevCount => prevCount + ITEMS_PER_LOAD);
      setIsLoadingMore(false);
    }, 500);
  }, [isLoadingMore, hasMore]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMoreItems();
        }
      },
      { threshold: 1.0 }
    );

    const currentObserverRef = observerRef.current;
    if (currentObserverRef) {
      observer.observe(currentObserverRef);
    }

    return () => {
      if (currentObserverRef) {
        observer.unobserve(currentObserverRef);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, loadMoreItems]);

  const displayedAnime = useMemo(() => {
    return filteredAnime.slice(0, displayedCount);
  }, [filteredAnime, displayedCount]);

  // ✅ IMPROVED LOADING STATES
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-slate-700/50 rounded w-48 animate-pulse"></div>
            <div className="h-8 bg-slate-700/50 rounded w-32 animate-pulse"></div>
          </div>
          <SkeletonLoader type="card" count={12} />
        </div>
      );
    }

    if (isSearching) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" text="Searching anime..." />
          <p className="text-slate-400 mt-4">Finding the best matches for you...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="col-span-full text-center py-16">
          <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-6 max-w-md mx-auto">
            <div className="text-4xl mb-4">😔</div>
            <h2 className="text-xl font-semibold text-red-400 mb-2">Oops! Something went wrong</h2>
            <p className="text-slate-300 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (displayedAnime.length === 0) {
      return (
        <div className="col-span-full text-center py-16">
          <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold text-slate-300 mb-2">
              {searchQuery ? 'No Anime Found' : 'No Anime Available'}
            </h2>
            <p className="text-slate-400">
              {searchQuery 
                ? `No results found for "${searchQuery}". Try different keywords.`
                : 'Check back later for new anime additions!'
              }
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <>
        {/* Replace the current grid with this more responsive version */}
        <div className="grid anime-grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3 md:gap-4 lg:gap-5">
          <Suspense fallback={<div className="col-span-full"><Spinner size="sm" /></div>}>
            {displayedAnime.map((anime, index) => (
              <React.Fragment key={anime.id}>
                <AnimeCard anime={anime} onClick={onAnimeSelect} index={index} />

                {/* ✅ AD AFTER EVERY 8th ITEM (reduced frequency) */}
                {(index + 1) % 8 === 0 && (
                  <div className="col-span-full my-4">
                    <AdSlot position="in_content" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </Suspense>
        </div>
       
        {/* ✅ LOADING MORE INDICATOR */}
        {isLoadingMore && (
          <div className="flex justify-center py-8">
            <Spinner size="md" text="Loading more anime..." />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* ✅ HEADER AD SLOT */}
      <div className="mb-6 hidden lg:block">
        <AdSlot position="header" />
      </div>
      {/* Search/Filter Status */}
      {(searchQuery || filter !== 'All') && !isLoading && (
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
          <p className="text-slate-300 text-sm">
            {searchQuery && `Showing results for: "${searchQuery}"`}
            {searchQuery && filter !== 'All' && ' • '}
            {filter !== 'All' && `Filter: ${filter}`}
            {` • ${displayedAnime.length} anime found`}
          </p>
        </div>
      )}
      {renderContent()}
     
      {/* Infinite scroll trigger */}
      {hasMore && !isLoadingMore && (
        <div ref={observerRef} className="h-10"></div>
      )}
    </div>
  );
};

export default HomePage;