 // components/Top100Page.tsx - FINAL: Tier Legend at bottom + A/B/C colors + 100 items
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
  { id: 'all', label: 'All', icon: '🎉' },
  { id: 'Anime', label: 'Anime', icon: '🎗️' },
  { id: 'Movie', label: 'Movies', icon: '🍻' },
  { id: 'Manga', label: 'Manga', icon: '🐦‍🔥' }
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
  ['#7C3AED', '#3B82F6', '#7C3AED'],
  ['#DC2626', '#DB2777', '#DC2626'],
  ['#059669', '#0D9488', '#059669'],
  ['#D97706', '#EA580C', '#D97706'],
  ['#4F46E5', '#7C3AED', '#4F46E5'],
  ['#DB2777', '#F472B6', '#DB2777'],
  ['#0891B2', '#3B82F6', '#0891B2'],
  ['#059669', '#047857', '#059669'],
];

// ✅ UPDATED: Vibrant new colors for A, B, C tiers
const getTierFromRank = (rank: number): { tier: string; bgGradient: string; textColor: string; glow: string } => {
  if (rank === 1) {
    return {
      tier: 'SSS',
      bgGradient: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
      textColor: 'text-black',
      glow: 'shadow-[0_0_25px_rgba(255,215,0,0.8)]'
    };
  } else if (rank === 2) {
    return {
      tier: 'SS',
      bgGradient: 'bg-gradient-to-r from-gray-300 to-gray-500',
      textColor: 'text-black',
      glow: 'shadow-[0_0_20px_rgba(192,192,192,0.6)]'
    };
  } else if (rank === 3) {
    return {
      tier: 'S',
      bgGradient: 'bg-gradient-to-r from-orange-500 to-red-600',
      textColor: 'text-white',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.7)]'
    };
  } else if (rank >= 4 && rank <= 10) {
    return {
      tier: 'A',
      bgGradient: 'bg-gradient-to-r from-fuchsia-500 to-pink-600',
      textColor: 'text-white',
      glow: 'shadow-[0_0_12px_rgba(217,70,239,0.7)]'
    };
  } else if (rank >= 11 && rank <= 20) {
    return {
      tier: 'B',
      bgGradient: 'bg-gradient-to-r from-teal-400 to-cyan-600',
      textColor: 'text-white',
      glow: 'shadow-[0_0_12px_rgba(20,184,166,0.7)]'
    };
  } else if (rank >= 21 && rank <= 30) {
    return {
      tier: 'C',
      bgGradient: 'bg-gradient-to-r from-lime-500 to-green-600',
      textColor: 'text-white',
      glow: 'shadow-[0_0_10px_rgba(132,204,22,0.6)]'
    };
  } else if (rank >= 31 && rank <= 50) {
    return {
      tier: 'D',
      bgGradient: 'bg-gradient-to-r from-yellow-600 to-yellow-800',
      textColor: 'text-black',
      glow: 'shadow-[0_0_10px_rgba(234,179,8,0.5)]'
    };
  } else if (rank >= 51 && rank <= 70) {
    return {
      tier: 'E',
      bgGradient: 'bg-gradient-to-r from-orange-600 to-orange-800',
      textColor: 'text-white',
      glow: 'shadow-[0_0_10px_rgba(249,115,22,0.5)]'
    };
  } else if (rank >= 71 && rank <= 100) {
    return {
      tier: 'F',
      bgGradient: 'bg-gradient-to-r from-red-600 to-red-800',
      textColor: 'text-white',
      glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]'
    };
  }
  return {
    tier: 'F',
    bgGradient: 'bg-gradient-to-r from-gray-600 to-gray-800',
    textColor: 'text-white',
    glow: ''
  };
};

// ✅ Ranking badge – ONLY TIER, no number
const RankingBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const { tier, bgGradient, textColor, glow } = getTierFromRank(rank);
  return (
    <div className={`absolute top-2 left-2 w-8 h-8 sm:w-10 sm:h-10 ${bgGradient} ${textColor} ${glow} rounded-xl flex items-center justify-center font-bold text-base sm:text-lg z-10 border-r border-b border-purple-800/50`}>
      {tier}
    </div>
  );
};

// ✅ TIER LEGEND – “How Rankings Work” के ऊपर दिखेगा
const TierLegend: React.FC = () => {
  const tiers = [
    { tier: 'SSS', range: '1', bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600', text: 'text-black' },
    { tier: 'SS', range: '2', bg: 'bg-gradient-to-r from-gray-300 to-gray-500', text: 'text-black' },
    { tier: 'S', range: '3', bg: 'bg-gradient-to-r from-orange-500 to-red-600', text: 'text-white' },
    { tier: 'A', range: '4-10', bg: 'bg-gradient-to-r from-fuchsia-500 to-pink-600', text: 'text-white' },
    { tier: 'B', range: '11-20', bg: 'bg-gradient-to-r from-teal-400 to-cyan-600', text: 'text-white' },
    { tier: 'C', range: '21-30', bg: 'bg-gradient-to-r from-lime-500 to-green-600', text: 'text-white' },
    { tier: 'D', range: '31-50', bg: 'bg-gradient-to-r from-yellow-600 to-yellow-800', text: 'text-black' },
    { tier: 'E', range: '51-70', bg: 'bg-gradient-to-r from-orange-600 to-orange-800', text: 'text-white' },
    { tier: 'F', range: '71-100', bg: 'bg-gradient-to-r from-red-600 to-red-800', text: 'text-white' },
  ];

  return (
    <div className="bg-purple-800/40 backdrop-blur-sm rounded-xl p-4 border border-purple-700 shadow-xl mb-4">
      <h3 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
        <span>🏆</span> Ranking Tiers
      </h3>
      <div className="flex flex-wrap gap-2">
        {tiers.map(({ tier, range, bg, text }) => (
          <div
            key={tier}
            className={`${bg} ${text} px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg`}
          >
            <span>{tier}</span>
            <span className="opacity-90 text-[10px]">#{range}</span>
          </div>
        ))}
      </div>
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
  const ITEMS_PER_PAGE = 100; // ✅ अब 45+ एनीमे एक साथ दिखेंगे

  // Border color interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBorderColorIndex((prev) => (prev + 1) % BORDER_COLORS.length);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const getAnimeId = (anime: Anime): string => {
    if (anime.id) return anime.id;
    if (anime._id) return anime._id;
    return `${anime.title}-${anime.releaseYear || 'unknown'}`;
  };

  const [globalRankings, setGlobalRankings] = useState<Map<string, number>>(new Map());

  const fetchTopAnime = async (page = 1, period = selectedPeriod, type = selectedType) => {
    try {
      if (page === 1) { setLoading(true); setGlobalRankings(new Map()); } 
      else setIsLoadingMore(true);
      setError(null);
      
      const response = await getTopAnime({
        type: period,
        contentType: type === 'all' ? undefined : type,
        limit: ITEMS_PER_PAGE,
        page
      });
      
      if (response.success && Array.isArray(response.data)) {
        const newAnimeList = page === 1 ? response.data : [...animeList, ...response.data];
        setAnimeList(newAnimeList);
        
        if (page === 1) {
          const newRankings = new Map();
          response.data.forEach((anime, idx) => newRankings.set(getAnimeId(anime), idx + 1));
          setGlobalRankings(newRankings);
        } else {
          const newRankings = new Map(globalRankings);
          const startRank = (page - 1) * ITEMS_PER_PAGE + 1;
          response.data.forEach((anime, idx) => {
            const id = getAnimeId(anime);
            if (!newRankings.has(id)) newRankings.set(id, startRank + idx);
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
      console.error(err);
      setError(err.message || 'Failed to load rankings');
      if (page === 1) { setAnimeList([]); setGlobalRankings(new Map()); }
    } finally {
      if (page === 1) setLoading(false); else setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTopAnime(1, selectedPeriod, selectedType);
  }, [selectedPeriod, selectedType]);

  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore || !isMounted.current) return;
    await fetchTopAnime(currentPage + 1, selectedPeriod, selectedType);
  }, [currentPage, hasMore, isLoadingMore, selectedPeriod, selectedType]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;
      if (scrollTop + windowHeight >= docHeight * 0.8) loadMoreAnime();
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, loadMoreAnime]);

  const handlePeriodChange = (period: RankingPeriod) => setSelectedPeriod(period);
  const handleTypeChange = (type: ContentTypeFilter) => setSelectedType(type);

  const filteredAnime = useMemo(() => {
    if (!animeList.length) return [];
    let list = [...animeList];
    if (selectedType !== 'all') list = list.filter(a => a.contentType === selectedType);
    const unique = new Map<string, Anime>();
    list.forEach(anime => unique.set(getAnimeId(anime), anime));
    return Array.from(unique.values());
  }, [animeList, selectedType]);

  const getAnimeRank = (anime: Anime): number => globalRankings.get(getAnimeId(anime)) || 0;

  const getSEOData = () => {
    const periodLabel = rankingPeriods.find(p => p.id === selectedPeriod)?.label || 'All Time';
    const typeLabel = contentTypeFilters.find(t => t.id === selectedType)?.label || 'All';
    return {
      title: `Top 100 ${typeLabel} Anime Rankings ${periodLabel} | AnimeBing`,
      description: `Discover the top 100 ${typeLabel.toLowerCase()} ranked by likes ${periodLabel.toLowerCase()}.`,
      keywords: `top anime, most liked anime, anime rankings, top 100 anime ${selectedPeriod}, ${selectedType} rankings`,
      canonicalUrl: `https://animebing.in/top-100?period=${selectedPeriod}&type=${selectedType}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `Top 100 ${typeLabel} Anime Rankings - ${periodLabel}`,
        "numberOfItems": 100,
      }
    };
  };

  const seoData = getSEOData();

  // Loading state
  if (loading && animeList.length === 0) {
    return (
      <>
        <SEO title="Loading Rankings... | AnimeBing" description="Discover the top 100 anime ranked by likes." />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 pt-8 pb-12">
          <div className="container mx-auto px-2">
            <div className="flex items-center justify-between mb-2 mt-0">
              <button onClick={onBack} className="group bg-purple-800/60 hover:bg-purple-700/80 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm">
                <span className="group-hover:-translate-x-0.5">←</span>
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                🏆 TOP 100 Rankings
              </h1>
              <div className="w-10"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden">
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
      <SEO {...seoData} />
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 pt-8 pb-12">
        <style>{`
          @keyframes subtle-glow { 0%,100% { opacity:0.4; filter:drop-shadow(0 0 10px currentColor); } 50% { opacity:0.6; filter:drop-shadow(0 0 25px currentColor); } }
          @keyframes shimmer { 0% { transform: translateX(-100%) rotate(45deg); } 100% { transform: translateX(100%) rotate(45deg); } }
          @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-3px); } }
          @keyframes pulse-subtle { 0%,100% { opacity:0.5; transform: scale(1); } 50% { opacity:0.7; transform: scale(1.01); } }
          .enhanced-glow { animation: pulse-subtle 3s ease-in-out infinite; }
          .card-hover-effect:hover { transform: translateY(-4px) scale(1.01); transition: transform 0.3s ease-out; }
          .shimmer-effect { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); animation: shimmer 3s infinite; }
          .sparkle-effect { animation: sparkle 2s ease-in-out infinite; }
          @keyframes sparkle { 0%,100% { opacity:0.2; transform: scale(0.8); } 50% { opacity:0.5; transform: scale(1.1); } }
          .border-transition { transition: background 0.8s ease-in-out; }
        `}</style>
        
        <div className="container mx-auto px-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 mt-0">
            <button onClick={onBack} className="group bg-purple-800/60 hover:bg-purple-700/80 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm backdrop-blur-sm border border-purple-700">
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              🏆 TOP 100 Rankings
            </h1>
            <div className="w-10"></div>
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
                    className={`px-2 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all ${
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
                    className={`px-2 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all flex items-center gap-1 ${
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
              <button onClick={() => fetchTopAnime(1, selectedPeriod, selectedType)} className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* Rankings Grid */}
          {!loading && filteredAnime.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredAnime.map((anime, index) => {
                  const globalRank = getAnimeRank(anime);
                  return (
                    <div key={`${getAnimeId(anime)}-${index}`} className="group relative">
                      {/* Glow Effects */}
                      <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br ${BORDER_COLORS[currentBorderColorIndex]} enhanced-glow border-transition`}
                        style={{ backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}, ${GLOW_COLORS[currentBorderColorIndex][1]}, ${GLOW_COLORS[currentBorderColorIndex][2]})` }} />
                      <div className="absolute -inset-0 rounded-xl opacity-30 blur-md transition-all duration-500 group-hover:opacity-50"
                        style={{ backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}40, ${GLOW_COLORS[currentBorderColorIndex][1]}40, ${GLOW_COLORS[currentBorderColorIndex][2]}40)` }} />
                      
                      {/* Ranking Badge (Only Tier) */}
                      <div className="absolute top-0 left-0 z-20">
                        <RankingBadge rank={globalRank} />
                      </div>
                      
                      {/* Card */}
                      <div className="card-hover-effect relative rounded-xl border border-purple-700/30 bg-gradient-to-b from-purple-900/95 to-purple-800/90 p-1 transition-all duration-300 overflow-hidden group-hover:border-transparent">
                        <div className="shimmer-effect"></div>
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                          style={{ background: `radial-gradient(circle at center, ${GLOW_COLORS[currentBorderColorIndex][1]}20 0%, transparent 70%)` }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 via-transparent to-transparent opacity-40 group-hover:opacity-30 transition-opacity duration-300"></div>
                        
                        {/* Sparkle particles */}
                        <div className="absolute top-2 right-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30"
                          style={{ background: GLOW_COLORS[currentBorderColorIndex][0], boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][0]}`, animationDelay: '0.2s' }} />
                        <div className="absolute bottom-2 left-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30"
                          style={{ background: GLOW_COLORS[currentBorderColorIndex][1], boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][1]}`, animationDelay: '0.5s' }} />
                        
                        {/* Anime Card - No status badge */}
                        <AnimeCard anime={anime} onClick={() => onAnimeSelect(anime)} index={index} showStatus={false} />
                        
                        {/* Bottom section: Type & Likes */}
                        <div className="mt-1 pt-1 border-t border-purple-700/50">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-purple-300">{anime.contentType || 'Anime'}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-green-400 font-bold">{anime.likes?.toLocaleString() || '0'}</span>
                              <span className="text-purple-300 font-medium">Like</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Corner accents & floating dots (keep as before) */}
                        {/* ... (omitted for brevity, but keep your existing code) ... */}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Loading more skeletons */}
              {isLoadingMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-700/10 to-transparent animate-shimmer"></div>
                      <SkeletonLoader />
                    </div>
                  ))}
                </div>
              )}
               {/* ✅ End of List - Total items वाली लाइन हटा दी गई */}
               {!hasMore && filteredAnime.length > 0 && (
                 <div className="text-center py-6">
                  <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-xl p-4 max-w-md mx-auto">
                   <div className="text-yellow-300 text-xl mb-1">🏆 Ranking Complete!</div>
                   <p className="text-purple-300 text-sm">
                    You've reached the end of the Top 100 rankings.
                  </p>
                 {/* ✅ पूरी लाइन हटाई – Total items अब नहीं दिखेगा */}
               </div>
             </div>
             )} </>
          )}
          {/* Empty State */}
          {!loading && !error && filteredAnime.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-purple-800/50 rounded-2xl p-8 max-w-md mx-auto border border-purple-700">
                <div className="text-4xl mb-4">😕</div>
                <h3 className="text-xl font-semibold text-purple-300 mb-3">No Rankings Found</h3>
                <p className="text-purple-400">No {selectedType === 'all' ? 'content' : selectedType.toLowerCase()} found for the selected period.</p>
                <button onClick={() => { setSelectedType('all'); setSelectedPeriod('all-time'); }} className="mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg">
                  Reset Filters
                </button>
              </div>
            </div>
          )}

          {/* ✅ TIER LEGEND – अब “How Rankings Work” के ऊपर दिख रहा है */}
          <TierLegend />

          {/* Information Section */}
          <div className="mt-8 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-700/30 rounded-xl p-4">
            <h3 className="text-base font-semibold text-blue-300 mb-2">💡 How Rankings Work</h3>
            <ul className="space-y-1 text-purple-300 text-sm">
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong>All Time:</strong> Based on total likes received since launch</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong>This Month:</strong> Based on likes received in the last 30 days</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong>This Week:</strong> Based on likes received in the last 7 days</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong>Voting:</strong> You can like/dislike anime on their detail pages</span></li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Top100Page;