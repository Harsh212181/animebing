 // components/Top100Page.tsx - FIXED RANKING CALCULATION
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Anime } from '../src/types';
import { getTopAnime } from '../services/animeService';
import Spinner from './Spinner';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import SEO from '../src/components/SEO';

// Define ranking period types
type RankingPeriod = 'all-time' | 'monthly' | 'weekly';
type ContentTypeFilter = 'all' | 'Anime' | 'Movie' | 'Manga';

// Ranking periods with descriptions
const rankingPeriods: { id: RankingPeriod; label: string; description: string }[] = [
  { id: 'all-time', label: 'All Time', description: 'Top 100 based on total likes' },
  { id: 'monthly', label: 'This Month', description: 'Top 100 based on likes this month' },
  { id: 'weekly', label: 'This Week', description: 'Top 100 based on likes this week' }
];

// Content type filters
const contentTypeFilters: { id: ContentTypeFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🎯' },
  { id: 'Anime', label: 'Anime', icon: '📺' },
  { id: 'Movie', label: 'Movies', icon: '🎬' },
  { id: 'Manga', label: 'Manga', icon: '📖' }
];

// Enhanced border colors with stronger gradients (same as HomePage)
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

// Softer glow colors for hover effects (same as HomePage)
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

// Ranking badge component - updated to match new design
const RankingBadge: React.FC<{ rank: number }> = ({ rank }) => {
  let bgColor = 'bg-gradient-to-r from-purple-600 to-purple-800';
  let textColor = 'text-white';
  let glowColor = '';
  
  if (rank === 1) {
    bgColor = 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    textColor = 'text-black';
    glowColor = 'shadow-[0_0_20px_rgba(255,215,0,0.6)]';
  } else if (rank === 2) {
    bgColor = 'bg-gradient-to-r from-gray-300 to-gray-500';
    textColor = 'text-black';
    glowColor = 'shadow-[0_0_15px_rgba(192,192,192,0.5)]';
  } else if (rank === 3) {
    bgColor = 'bg-gradient-to-r from-amber-600 to-amber-800';
    textColor = 'text-white';
    glowColor = 'shadow-[0_0_10px_rgba(205,127,50,0.5)]';
  }
  
  return (
    <div className={`absolute top-2 left-2 w-8 h-8 sm:w-10 sm:h-10 ${bgColor} ${textColor} ${glowColor} rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm md:text-base z-10 border-r border-b border-purple-800/50`}>
      #{rank}
    </div>
  );
};

interface Top100PageProps {
  onAnimeSelect: (anime: Anime) => void;
  onBack: () => void;
}

const Top100Page: React.FC<Top100PageProps> = ({ onAnimeSelect, onBack }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>('all-time');
  const [selectedType, setSelectedType] = useState<ContentTypeFilter>('all');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentBorderColorIndex, setCurrentBorderColorIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const isMounted = useRef(true);
  const ITEMS_PER_PAGE = 36;

  // Border color interval - same as HomePage
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

  // Helper function to get unique anime ID
  const getAnimeId = (anime: Anime): string => {
    if (anime.id) return anime.id;
    if (anime._id) return anime._id;
    // Fallback: generate a unique key from title and releaseYear
    return `${anime.title}-${anime.releaseYear || 'unknown'}`;
  };

  // ✅ FIXED: Properly track rankings with server-side ranking
  const [globalRankings, setGlobalRankings] = useState<Map<string, number>>(new Map());

  // Fetch top anime data
  const fetchTopAnime = async (page = 1, period = selectedPeriod, type = selectedType) => {
    try {
      if (page === 1) {
        setLoading(true);
        setGlobalRankings(new Map()); // Reset rankings for new filter
      } else {
        setIsLoadingMore(true);
      }
      setError(null);
      
      const response = await getTopAnime({
        type: period,
        contentType: type === 'all' ? undefined : type,
        limit: ITEMS_PER_PAGE,
        page: page
      });
      
      if (response.success && Array.isArray(response.data)) {
        const newAnimeList = page === 1 ? response.data : [...animeList, ...response.data];
        setAnimeList(newAnimeList);
        
        // ✅ FIXED: Calculate correct global rankings
        if (page === 1) {
          // For first page, rankings start from 1
          const newRankings = new Map();
          response.data.forEach((anime, index) => {
            const id = getAnimeId(anime);
            newRankings.set(id, index + 1);
          });
          setGlobalRankings(newRankings);
        } else {
          // For subsequent pages, continue from previous ranking
          const newRankings = new Map(globalRankings);
          const startRank = (page - 1) * ITEMS_PER_PAGE + 1;
          response.data.forEach((anime, index) => {
            const id = getAnimeId(anime);
            if (!newRankings.has(id)) {
              newRankings.set(id, startRank + index);
            }
          });
          setGlobalRankings(newRankings);
        }
        
        setTotalItems(response.pagination?.totalItems || response.data.length);
        setHasMore(response.pagination?.hasMore || false);
        setCurrentPage(page);
      } else {
        throw new Error(response.error || 'Failed to load top anime');
      }
    } catch (err: any) {
      console.error('Error fetching top anime:', err);
      setError(err.message || 'Failed to load rankings');
      if (page === 1) {
        setAnimeList([]);
        setGlobalRankings(new Map());
      }
    } finally {
      if (page === 1) {
        setLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  // Initial fetch and when filters change
  useEffect(() => {
    fetchTopAnime(1, selectedPeriod, selectedType);
  }, [selectedPeriod, selectedType]);

  // Load more handler - simplified
  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    if (!isMounted.current) return;

    try {
      const nextPage = currentPage + 1;
      await fetchTopAnime(nextPage, selectedPeriod, selectedType);
    } catch {
      // Handle error silently for load more
    }
  }, [currentPage, hasMore, isLoadingMore, selectedPeriod, selectedType]);

  // Infinite Scroll - HomePage की तरह automatic
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;
      
      // Load more when 80% scrolled - HomePage की तरह
      if (scrollTop + windowHeight >= docHeight * 0.8) {
        loadMoreAnime();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, loadMoreAnime]);

  // Handle period change
  const handlePeriodChange = (period: RankingPeriod) => {
    setSelectedPeriod(period);
  };

  // Handle type change
  const handleTypeChange = (type: ContentTypeFilter) => {
    setSelectedType(type);
  };

  // ✅ FIXED: Filter anime list while preserving rankings
  const filteredAnime = useMemo(() => {
    if (!animeList.length) return [];
    
    let list = [...animeList];

    if (selectedType !== 'all') {
      list = list.filter(a => a.contentType === selectedType);
    }

    // Remove duplicates
    const uniqueAnimesMap = new Map<string, Anime>();
    
    for (const anime of list) {
      const id = getAnimeId(anime);
      
      if (!uniqueAnimesMap.has(id)) {
        uniqueAnimesMap.set(id, anime);
      }
    }
    
    return Array.from(uniqueAnimesMap.values());
  }, [animeList, selectedType]);

  // ✅ FIXED: Get correct ranking for each anime
  const getAnimeRank = (anime: Anime): number => {
    const id = getAnimeId(anime);
    return globalRankings.get(id) || 0;
  };

  // SEO data for the page
  const getSEOData = () => {
    const periodLabel = rankingPeriods.find(p => p.id === selectedPeriod)?.label || 'All Time';
    const typeLabel = contentTypeFilters.find(t => t.id === selectedType)?.label || 'All';
    
    return {
      title: `Top 100 ${typeLabel} Anime Rankings ${periodLabel} | AnimeBing`,
      description: `Discover the top 100 ${typeLabel.toLowerCase()} ranked by likes ${periodLabel.toLowerCase()}. Watch the most popular anime, movies, and manga on AnimeBing.`,
      keywords: `top anime 2024, most liked anime, popular anime rankings, anime leaderboard, top 100 anime ${selectedPeriod}, ${selectedType} rankings`,
      canonicalUrl: `https://animebing.in/top-100?period=${selectedPeriod}&type=${selectedType}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `Top 100 ${typeLabel} Anime Rankings - ${periodLabel}`,
        "description": `Ranking of the top 100 ${typeLabel.toLowerCase()} based on user likes.`,
        "numberOfItems": 100,
        "itemListOrder": "https://schema.org/Descending"
      }
    };
  };

  const seoData = getSEOData();

  // Full Loader
  if (loading && animeList.length === 0) {
    return (
      <>
        <SEO
          title="Loading Rankings... | AnimeBing"
          description="Discover the top 100 anime ranked by likes. Watch the most popular anime, movies, and manga."
          keywords="top anime, rankings, popular anime"
        />
        {/* ✅ Same purple background as HomePage */}
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 pt-16 pb-12">
          <div className="container mx-auto px-2">
            {/* Header with Back Button in same line */}
            <div className="flex items-center justify-between mb-2 mt-2">
              <button
                onClick={onBack}
                className="group bg-purple-800/60 hover:bg-purple-700/80 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all duration-300 font-medium backdrop-blur-sm border border-purple-700 hover:border-purple-500/30 text-sm"
              >
                <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                <span className="hidden sm:inline">Back</span>
              </button>
              
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                🏆 TOP 100 Rankings
              </h1>
              
              <div className="w-10"></div> {/* For balance */}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div 
                  key={`skeleton-${i}`} 
                  className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden"
                >
                  {/* Skeleton shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-700/10 to-transparent animate-shimmer"></div>
                  <SkeletonLoader />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        structuredData={seoData.structuredData}
      />
      
      {/* ✅ Same purple background as HomePage */}
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 pt-16 pb-12">
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
          
          .border-transition {
            transition: background 0.8s ease-in-out;
          }
        `}</style>
        
        <div className="container mx-auto px-2">
          {/* ✅ HEADER WITH BACK BUTTON IN SAME LINE */}
          <div className="flex items-center justify-between mb-4 mt-2">
            <button
              onClick={onBack}
              className="group bg-purple-800/60 hover:bg-purple-700/80 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all duration-300 font-medium backdrop-blur-sm border border-purple-700 hover:border-purple-500/30 text-sm"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
            
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              🏆 TOP 100 Rankings
            </h1>
            
            <div className="w-10"></div> {/* For balance */}
          </div>

          {/* Filters Section */}
          <div className="bg-purple-800/40 backdrop-blur-sm rounded-xl p-3 border border-purple-700 shadow-xl mb-4">
            {/* Period Filter */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {rankingPeriods.map(period => (
                  <button
                    key={period.id}
                    onClick={() => handlePeriodChange(period.id)}
                    className={`px-2 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all duration-300 ${
                      selectedPeriod === period.id
                        ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-purple-700/50 text-purple-300 hover:bg-purple-600/50 border border-purple-600'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Type Filter */}
            <div>
              <div className="flex flex-wrap gap-1">
                {contentTypeFilters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => handleTypeChange(filter.id)}
                    className={`px-2 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all duration-300 flex items-center gap-1 ${
                      selectedType === filter.id
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-purple-700/50 text-purple-300 hover:bg-purple-600/50 border border-purple-600'
                    }`}
                  >
                    <span>{filter.icon}</span>
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm text-center mb-4">
              <div className="text-red-300 text-base mb-2">⚠️ {error}</div>
              <button
                onClick={() => fetchTopAnime(1, selectedPeriod, selectedType)}
                className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Rankings Grid - SAME AS HOMEPAGE */}
          {!loading && filteredAnime.length > 0 && (
            <>
              {/* ✅ Cards Grid with same spacing as HomePage */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredAnime.map((anime, index) => {
                  // ✅ FIXED: Use global ranking instead of calculating from index
                  const globalRank = getAnimeRank(anime);
                  
                  return (
                    <div 
                      key={`${getAnimeId(anime)}-${index}`}
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
                      
                      {/* Ranking Badge */}
                      <div className="absolute top-0 left-0 z-20">
                        <RankingBadge rank={globalRank} />
                      </div>
                      
                      {/* Main Card Container - SAME AS HOMEPAGE */}
                      <div className="card-hover-effect relative rounded-xl border border-purple-700/30 bg-gradient-to-b from-purple-900/95 to-purple-800/90 p-1 transition-all duration-300 overflow-hidden group-hover:border-transparent">
                        
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
                        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 via-transparent to-transparent opacity-40 group-hover:opacity-30 transition-opacity duration-300"></div>
                        
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
                        
                        {/* ✅ Anime Card - showStatus को false किया गया है ताकि image के ऊपर का status badge न दिखे */}
                        <AnimeCard
                          anime={anime}
                          onClick={() => onAnimeSelect(anime)}
                          index={index}
                          showStatus={false} // ✅ Image के ऊपर का status badge हटा दिया गया
                        />
                        
                        {/* ✅ Bottom section में status और like count */}
                        <div className="mt-1 pt-1 border-t border-purple-700/50">
                          <div className="flex justify-between items-center text-xs">
                            {/* Left side - Content Type Status */}
                            <span className="text-purple-300">
                              {anime.contentType || 'Anime'}
                            </span>
                            
                            {/* Right side - Like Count */}
                            <div className="flex items-center gap-1">
                              <span className="text-green-400 font-bold">
                                {anime.likes?.toLocaleString() || '0'}
                              </span>
                              <span className="text-purple-300 font-medium">Like</span>
                            </div>
                          </div>
                        </div>
                        
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
                  );
                })}
              </div>

              {/* ✅ AUTOMATIC LOAD MORE - HomePage की तरह */}
              {isLoadingMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={`skeleton-${i}`} 
                      className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden"
                    >
                      {/* Skeleton shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-700/10 to-transparent animate-shimmer"></div>
                      <SkeletonLoader />
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ End of List - HomePage की तरह */}
              {!hasMore && filteredAnime.length > 0 && (
                <div className="text-center py-6">
                  <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-xl p-4 max-w-md mx-auto">
                    <div className="text-yellow-300 text-xl mb-1">🏆 Ranking Complete!</div>
                    <p className="text-purple-300 text-sm">
                      You've reached the end of the Top 100 rankings.
                    </p>
                    <p className="text-purple-400 text-xs mt-1">
                      Total items: {totalItems}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!loading && !error && filteredAnime.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-purple-800/50 rounded-2xl p-8 max-w-md mx-auto border border-purple-700">
                <div className="text-4xl mb-4">😕</div>
                <h3 className="text-xl font-semibold text-purple-300 mb-3">
                  No Rankings Found
                </h3>
                <p className="text-purple-400">
                  No {selectedType === 'all' ? 'content' : selectedType.toLowerCase()} found for the selected period.
                </p>
                <button
                  onClick={() => {
                    setSelectedType('all');
                    setSelectedPeriod('all-time');
                  }}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}

          {/* Information Section */}
          <div className="mt-8 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-700/30 rounded-xl p-4">
            <h3 className="text-base font-semibold text-blue-300 mb-2">💡 How Rankings Work</h3>
            <ul className="space-y-1 text-purple-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong>All Time:</strong> Based on total likes received since launch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong>This Month:</strong> Based on likes received in the last 30 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong>This Week:</strong> Based on likes received in the last 7 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong>Voting:</strong> You can like/dislike anime on their detail pages</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Top100Page;