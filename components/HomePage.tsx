 import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import { getAnimePaginated, searchAnime, getFeaturedAnime } from '../services/animeService';
import FeaturedAnimeCarousel from '../src/components/FeaturedAnimeCarousel';

interface Props {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  filter: FilterType;
  contentType: ContentTypeFilter;
}

const ANIME_FIELDS =
  'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';

// Enhanced border colors with stronger gradients
const BORDER_COLORS = [
  'from-purple-500 via-blue-400 to-purple-500',
  'from-red-400 via-pink-400 to-red-400',
  'from-green-400 via-teal-400 to-green-400',
  'from-yellow-400 via-orange-400 to-yellow-400',
  'from-indigo-400 via-purple-400 to-indigo-400',
  'from-pink-400 via-rose-400 to-pink-400',
  'from-cyan-400 via-blue-400 to-cyan-400',
  'from-emerald-400 via-green-400 to-emerald-400',
];

// Softer glow colors for hover effects
const GLOW_COLORS = [
  ['#7C3AED', '#3B82F6', '#7C3AED'], // purple-blue-purple
  ['#DC2626', '#DB2777', '#DC2626'], // red-pink-red
  ['#059669', '#0D9488', '#059669'], // green-teal-green
  ['#D97706', '#EA580C', '#D97706'], // yellow-orange-yellow
  ['#4F46E5', '#7C3AED', '#4F46E5'], // indigo-purple-indigo
  ['#DB2777', '#F472B6', '#DB2777'], // pink-rose-pink
  ['#0891B2', '#3B82F6', '#0891B2'], // cyan-blue-cyan
  ['#059669', '#047857', '#059669'], // emerald-green-emerald
];

const HomePage: React.FC<Props> = ({
  onAnimeSelect,
  searchQuery,
  filter,
  contentType
}) => {
  const [localFilter, setLocalFilter] = useState<FilterType>(filter || 'All');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [featuredAnimes, setFeaturedAnimes] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Naya state border color ke liye
  const [currentBorderColorIndex, setCurrentBorderColorIndex] = useState(0);
  
  // Refs for tracking
  const isMounted = useRef(true);
  const lastSearchQuery = useRef(searchQuery);

  // Border color ka interval - ab 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBorderColorIndex((prevIndex) => 
        (prevIndex + 1) % BORDER_COLORS.length
      );
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load Featured
  const fetchFeaturedAnimes = useCallback(async () => {
    try {
      const data = await getFeaturedAnime();
      if (data?.length && isMounted.current) {
        const limited = data.slice(0, 10);
        setFeaturedAnimes(limited);
        localStorage.setItem('featuredAnimes', JSON.stringify(limited));
      }
    } catch {
      const stored = localStorage.getItem('featuredAnimes');
      if (stored && isMounted.current) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setFeaturedAnimes(parsed.slice(0, 10));
        } catch {}
      }
    }
  }, []);

  // Heading
  const getAllContentHeading = useCallback(() => {
    if (isSearching && searchQuery) return `Search: ${searchQuery}`;
    if (contentType !== 'All') return `All ${contentType}`;
    switch (localFilter) {
      case 'Hindi Dub': return 'All Hindi Dub';
      case 'Hindi Sub': return 'All Hindi Sub';
      case 'English Sub': return 'All English Sub';
      default: return 'All Content';
    }
  }, [localFilter, contentType, isSearching, searchQuery]);

  // Helper function to get unique anime ID
  const getAnimeId = (anime: Anime): string => {
    if (anime.id) return anime.id;
    if (anime._id) return anime._id;
    // Fallback: generate a unique key from title and releaseYear
    return `${anime.title}-${anime.releaseYear || 'unknown'}`;
  };

  // Initial load
  const loadInitialAnime = useCallback(async (isSearch: boolean = false) => {
    if (!isMounted.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      if (isSearch) {
        // For search
        const data = await searchAnime(searchQuery, ANIME_FIELDS);
        if (data?.length && isMounted.current) {
          setAnimeList(data);
          setHasMore(false);
          setCurrentPage(1);
          setIsSearching(true);
        } else {
          setAnimeList([]);
          setHasMore(false);
        }
      } else {
        // For normal pagination
        const data = await getAnimePaginated(1, 36, ANIME_FIELDS);
        if (data?.length && isMounted.current) {
          setAnimeList(data);
          setHasMore(data.length === 36);
          setCurrentPage(1);
          setIsSearching(false);
        } else {
          setError('No anime found');
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(isSearch ? 'Search failed' : 'Failed to load anime');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [searchQuery]);

  // Load More - SIMPLIFIED: No duplicate filtering during load
  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore || isSearching) return;
    
    if (!isMounted.current) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getAnimePaginated(nextPage, 24, ANIME_FIELDS);

      if (data?.length && isMounted.current) {
        // SIMPLIFIED: Just append all new data
        // Duplicates will be handled in filteredAnime memo
        setAnimeList(prev => [...prev, ...data]);
        setCurrentPage(nextPage);
        setHasMore(data.length === 24);
      } else {
        setHasMore(false);
      }
    } catch {
      // Handle error silently for load more
    } finally {
      if (isMounted.current) {
        setIsLoadingMore(false);
      }
    }
  }, [currentPage, hasMore, isLoadingMore, isSearching]);

  // On mount and when filter/contentType changes
  useEffect(() => {
    if (isMounted.current) {
      loadInitialAnime();
      if (!searchQuery) {
        fetchFeaturedAnimes();
      }
    }
  }, [filter, contentType]);

  // Search effect - with improved logic
  useEffect(() => {
    if (!isMounted.current) return;

    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        if (searchQuery !== lastSearchQuery.current) {
          await loadInitialAnime(true);
          lastSearchQuery.current = searchQuery;
        }
      } else {
        // Clear search
        if (lastSearchQuery.current !== '') {
          loadInitialAnime(false);
          fetchFeaturedAnimes();
          lastSearchQuery.current = '';
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, loadInitialAnime, fetchFeaturedAnimes]);

  // Filtering - IMPROVED: Better duplicate handling
  const filteredAnime = useMemo(() => {
    if (!animeList.length) return [];
    
    let list = [...animeList];

    if (contentType !== 'All') {
      list = list.filter(a => a.contentType === contentType);
    }
    if (localFilter !== 'All') {
      list = list.filter(a => a.subDubStatus === localFilter);
    }

    // Remove duplicates using a more robust method
    const uniqueAnimesMap = new Map<string, Anime>();
    
    for (const anime of list) {
      const id = getAnimeId(anime);
      
      // Only add if not already in map
      if (!uniqueAnimesMap.has(id)) {
        uniqueAnimesMap.set(id, anime);
      }
    }
    
    return Array.from(uniqueAnimesMap.values());
  }, [animeList, localFilter, contentType]);

  const filterButtons = [
    { key: 'All' as FilterType, label: 'All' },
    { key: 'Hindi Dub' as FilterType, label: 'Hindi Dub' },
    { key: 'Hindi Sub' as FilterType, label: 'Hindi Sub' },
    { key: 'English Sub' as FilterType, label: 'English Sub' }
  ];

  const handleFilterChange = (f: FilterType) => setLocalFilter(f);

  // Infinite Scroll
  useEffect(() => {
    if (isSearching) return;

    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;
      
      // Load more when 80% scrolled
      if (scrollTop + windowHeight >= docHeight * 0.8) {
        loadMoreAnime();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, isSearching, loadMoreAnime]);

  // Reset when filter changes
  useEffect(() => {
    if (isMounted.current) {
      setLocalFilter(filter);
    }
  }, [filter]);

  // Full Loader
  if (isLoading && animeList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center bg-slate-800/80 backdrop-blur rounded-2xl p-8 border border-slate-700">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <style>{`
        @keyframes subtle-glow {
          0%, 100% {
            opacity: 0.4;
            filter: drop-shadow(0 0 10px currentColor);
          }
          50% {
            opacity: 0.6;
            filter: drop-shadow(0 0 25px currentColor);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(100%) rotate(45deg);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.01);
          }
        }
        
        .enhanced-glow {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
        
        .card-hover-effect:hover {
          transform: translateY(-4px) scale(1.01);
          transition: transform 0.3s ease-out;
        }
        
        .shimmer-effect {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.08),
            transparent
          );
          animation: shimmer 3s infinite;
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.8);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }
        
        .sparkle-effect {
          animation: sparkle 2s ease-in-out infinite;
        }
        
        /* Smooth transition for border color change */
        .border-transition {
          transition: background 0.8s ease-in-out;
        }
        
        /* Custom scrollbar for filter buttons */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      <div className="container mx-auto px-3 sm:px-4 py-4 lg:py-8">

        {/* Featured */}
        {!searchQuery && !isSearching && featuredAnimes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
              Latest Content
            </h2>
            <FeaturedAnimeCarousel
              featuredAnimes={featuredAnimes}
              onAnimeSelect={onAnimeSelect}
            />
          </div>
        )}

        {/* Mobile Filter Buttons - Only visible on mobile */}
        {!isSearching && (
          <div className="mb-3 lg:hidden">
            <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1.5 scrollbar-hide px-1">
              {filterButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => handleFilterChange(btn.key)}
                  className={`
                    px-2.5 py-1.5 rounded text-[10px] sm:text-[11px] font-medium transition-all duration-200
                    border whitespace-nowrap flex-shrink-0 min-w-[62px] sm:min-w-[68px]
                    ${
                      localFilter === btn.key
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-lg shadow-blue-500/40'
                        : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700/90'
                    }
                  `}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {filteredAnime.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-10 max-w-md mx-auto border border-slate-700">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {searchQuery ? 'No Results Found' : 'No Content'}
              </h2>
              {!searchQuery && localFilter !== 'All' && (
                <button
                  onClick={() => handleFilterChange('All')}
                  className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/40 text-white px-8 py-3 rounded-xl font-bold transition-all duration-300"
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Header - Clean design without count */}
            <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-6">
              {getAllContentHeading()}
            </h2>

            {/* Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredAnime.map((anime, i) => (
                <div 
                  key={`${getAnimeId(anime)}-${i}`}
                  className="group relative"
                >
                  {/* Main Balanced Glow Effect */}
                  <div 
                    className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br ${BORDER_COLORS[currentBorderColorIndex]} enhanced-glow border-transition`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}, ${GLOW_COLORS[currentBorderColorIndex][1]}, ${GLOW_COLORS[currentBorderColorIndex][2]})`,
                    }}
                  ></div>
                  
                  {/* Secondary Glow Layer - Reduced intensity */}
                  <div 
                    className="absolute -inset-0 rounded-xl opacity-30 blur-md transition-all duration-500 group-hover:opacity-50"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}40, ${GLOW_COLORS[currentBorderColorIndex][1]}40, ${GLOW_COLORS[currentBorderColorIndex][2]}40)`,
                    }}
                  ></div>
                  
                  {/* Main Card Container */}
                  <div className="card-hover-effect relative rounded-xl border border-slate-700/30 bg-gradient-to-b from-slate-900/95 to-slate-800/90 p-1.5 transition-all duration-300 overflow-hidden group-hover:border-transparent">
                    
                    {/* Subtle Shimmer Effect */}
                    <div className="shimmer-effect"></div>
                    
                    {/* Subtle Inner Glow Effect */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at center, ${GLOW_COLORS[currentBorderColorIndex][1]}20 0%, transparent 70%)`,
                      }}
                    ></div>
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-40 group-hover:opacity-30 transition-opacity duration-300"></div>
                    
                    {/* Subtle sparkle particles */}
                    <div className="absolute top-2 right-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][0],
                        boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][0]}`,
                        animationDelay: '0.2s'
                      }}
                    ></div>
                    <div className="absolute bottom-2 left-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][1],
                        boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][1]}`,
                        animationDelay: '0.5s'
                      }}
                    ></div>
                    
                    <AnimeCard
                      anime={anime}
                      onClick={onAnimeSelect}
                      index={i}
                      showStatus={true}
                    />
                    
                    {/* Subtle Corner Accents */}
                    <div 
                      className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l rounded-tl-xl opacity-0 group-hover:opacity-70 transition-all duration-300"
                      style={{
                        borderColor: GLOW_COLORS[currentBorderColorIndex][0],
                      }}
                    ></div>
                    <div 
                      className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r rounded-tr-xl opacity-0 group-hover:opacity-70 transition-all duration-300"
                      style={{
                        borderColor: GLOW_COLORS[currentBorderColorIndex][1],
                        animationDelay: '0.3s'
                      }}
                    ></div>
                    <div 
                      className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l rounded-bl-xl opacity-0 group-hover:opacity-70 transition-all duration-300"
                      style={{
                        borderColor: GLOW_COLORS[currentBorderColorIndex][2],
                        animationDelay: '0.6s'
                      }}
                    ></div>
                    <div 
                      className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r rounded-br-xl opacity-0 group-hover:opacity-70 transition-all duration-300"
                      style={{
                        borderColor: GLOW_COLORS[currentBorderColorIndex][0],
                        animationDelay: '0.9s'
                      }}
                    ></div>
                    
                    {/* Subtle Floating Dots */}
                    <div className="absolute -top-0.5 -left-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][0],
                        boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][0]}`,
                        animation: 'float 2s ease-in-out infinite',
                      }}
                    ></div>
                    <div className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-75"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][1],
                        boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][1]}`,
                        animation: 'float 2s ease-in-out infinite 0.5s',
                      }}
                    ></div>
                    <div className="absolute -bottom-0.5 -left-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-150"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][2],
                        boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][2]}`,
                        animation: 'float 2s ease-in-out infinite 1s',
                      }}
                    ></div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-225"
                      style={{
                        background: GLOW_COLORS[currentBorderColorIndex][0],
                        boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][0]}`,
                        animation: 'float 2s ease-in-out infinite 1.5s',
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && !isSearching && !searchQuery && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMoreAnime}
                  disabled={isLoadingMore}
                  className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60 transition-all duration-300 group"
                  style={{
                    animation: 'pulse-subtle 4s ease-in-out infinite'
                  }}
                >
                  {/* Button Glow Effect */}
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-70 transition-opacity duration-300"></span>
                  <span className="relative z-10">
                    {isLoadingMore ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⟳</span>
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </span>
                </button>
              </div>
            )}

            {isLoadingMore && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mt-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div 
                    key={`skeleton-${i}`} 
                    className="relative rounded-xl border border-slate-700/40 p-1.5 bg-gradient-to-b from-slate-900/80 to-slate-800/70 overflow-hidden"
                  >
                    {/* Skeleton shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/10 to-transparent animate-shimmer"></div>
                    <SkeletonLoader />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;