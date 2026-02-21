 import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import { getAnimePaginated, searchAnime, getFeaturedAnime } from '../services/animeService';
import FeaturedAnimeCarousel from '../src/components/FeaturedAnimeCarousel';
import SEO from '../src/components/SEO';
import PollCard from './PollCard';

interface Props {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  filter: FilterType;
  contentType: ContentTypeFilter;
}

const ANIME_FIELDS =
  'title,thumbnail,releaseYear,status,contentType,subDubStatus,description,genreList';

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

// ✅ FIXED: Same pattern as PollCard – API_BASE_URL includes /api
const API_BASE_URL = import.meta.env.VITE_API_BASE || 
  (import.meta.env.MODE === 'production' 
    ? 'https://animabing.onrender.com/api' 
    : 'http://localhost:3000/api');   // ← now includes /api

// ✅ Poll endpoint – consistent with PollCard
const POLL_API_URL = `${API_BASE_URL}/poll`;

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
  const [isPollActive, setIsPollActive] = useState(false);
  const [pollChecked, setPollChecked] = useState(false);
  
  const [currentBorderColorIndex, setCurrentBorderColorIndex] = useState(0);
  
  const isMounted = useRef(true);
  const lastSearchQuery = useRef(searchQuery);

  // ✅ FIXED: Uses POLL_API_URL = API_BASE_URL/poll
  const checkPollStatus = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔍 HomePage: Checking poll status...');
      console.log('📡 Poll endpoint:', `${POLL_API_URL}/active`);
      
      const res = await fetch(`${POLL_API_URL}/active`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        console.log('📭 HomePage: No active poll available (HTTP error)');
        return false;
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return false;
      }
      
      const data = await res.json();
      console.log('📦 HomePage: Poll API response:', data);
      
      const isActive = data.success && data.poll && data.poll.isActive !== false;
      console.log('🔍 HomePage: Poll status is', isActive);
      return isActive;
    } catch (err) {
      console.error('❌ HomePage: Error checking poll status:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;

    const checkPoll = async () => {
      if (searchQuery.trim() || isSearching) {
        setIsPollActive(false);
        setPollChecked(true);
        return;
      }
      
      try {
        const active = await checkPollStatus();
        if (isMounted.current) {
          setIsPollActive(active);
          setPollChecked(true);
        }
      } catch (error) {
        if (isMounted.current) {
          setIsPollActive(false);
          setPollChecked(true);
        }
      }
    };

    const timer = setTimeout(() => {
      checkPoll();
    }, 100);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearching, checkPollStatus]);

  const getSEOData = () => {
    let title = 'Watch Anime Online in Hindi & English | AnimeBing';
    let description = 'AnimeBing - Watch anime online for free in Hindi Dub, Hindi Sub, and English Sub. HD quality streaming and downloads. Latest anime episodes and movies.';
    let keywords = 'watch anime online, hindi anime, english anime, anime in hindi, anime in english, free anime streaming, anime download, anime binge';
    
    if (searchQuery.trim()) {
      title = `Search "${searchQuery}" - Watch Anime Online | AnimeBing`;
      description = `Search results for "${searchQuery}". Watch anime online in Hindi and English. Free HD streaming.`;
      keywords = `${searchQuery} anime, ${searchQuery} hindi dub, ${searchQuery} english sub, watch ${searchQuery} online`;
    } else if (localFilter !== 'All') {
      if (localFilter === 'Hindi Dub') {
        title = 'Watch Hindi Dubbed Anime Online | AnimeBing';
        description = 'Watch Hindi dubbed anime online for free. All latest anime in Hindi dub with HD quality. Naruto, One Piece, Demon Slayer and more.';
        keywords = 'hindi dubbed anime, anime in hindi dub, watch hindi dub anime online, naruto hindi dub, one piece hindi dub, free hindi anime';
      } else if (localFilter === 'Hindi Sub') {
        title = 'Watch Hindi Subbed Anime Online | AnimeBing';
        description = 'Watch Hindi subbed anime online for free. Latest anime with Hindi subtitles in HD quality.';
        keywords = 'hindi subbed anime, anime in hindi sub, watch hindi sub anime online, anime with hindi subtitles';
      } else if (localFilter === 'English Sub') {
        title = 'Watch English Subbed Anime Online | AnimeBing';
        description = 'Watch English subbed anime online for free. Latest anime with English subtitles in HD quality.';
        keywords = 'english subbed anime, anime in english sub, watch english sub anime online, anime with english subtitles';
      }
    } else if (contentType !== 'All') {
      if (contentType === 'Movie') {
        title = 'Watch Anime Movies Online | AnimeBing';
        description = 'Watch anime movies online for free in Hindi and English. Full length anime movies in HD quality.';
        keywords = 'anime movies, watch anime movies online, hindi anime movies, english anime movies';
      } else if (contentType === 'Manga') {
        title = 'Read Manga Online | AnimeBing';
        description = 'Read manga online for free. Latest manga chapters available.';
        keywords = 'read manga online, manga, free manga, manga chapters';
      }
    }
    
    let canonicalUrl = 'https://animebing.in';
    const params = new URLSearchParams();
    
    if (localFilter !== 'All') params.set('filter', localFilter);
    if (contentType !== 'All') params.set('contentType', contentType);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    
    if (params.toString()) canonicalUrl += `?${params.toString()}`;
    
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "AnimeBing",
      "url": "https://animebing.in",
      "description": "Watch anime online for free in Hindi and English. HD quality streaming and downloads.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://animebing.in?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };
    
    return { title, description, keywords, canonicalUrl, structuredData, ogUrl: window.location.href };
  };

  const seoData = getSEOData();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBorderColorIndex((prevIndex) => 
        (prevIndex + 1) % BORDER_COLORS.length
      );
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const fetchFeaturedAnimes = useCallback(async () => {
    try {
      const data = await getFeaturedAnime();
      if (data?.length && isMounted.current) {
        const limited = data.slice(0, 24);
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

  const getAllContentHeading = useCallback(() => {
    if (isSearching && searchQuery) return { text: `Search: ${searchQuery}`, emojiStart: '', emojiEnd: '' };
    if (contentType !== 'All') return { text: `All ${contentType}`, emojiStart: '', emojiEnd: '' };
    switch (localFilter) {
      case 'Hindi Dub': return { text: 'All Hindi Dub', emojiStart: '🪁', emojiEnd: '🪁' };
      case 'Hindi Sub': return { text: 'All Hindi Sub', emojiStart: '👀', emojiEnd: '👀' };
      case 'English Sub': return { text: 'All English Sub', emojiStart: '🎗️', emojiEnd: '🎗️' };
      default: return { text: 'All Anime', emojiStart: '🍂', emojiEnd: '🍂' };
    }
  }, [localFilter, contentType, isSearching, searchQuery]);

  const headingData = getAllContentHeading();

  const getAnimeId = (anime: Anime): string => {
    if (anime.id) return anime.id;
    if (anime._id) return anime._id;
    return `${anime.title}-${anime.releaseYear || 'unknown'}`;
  };

  const loadInitialAnime = useCallback(async (isSearch: boolean = false) => {
    if (!isMounted.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      if (isSearch) {
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
      if (isMounted.current) setIsLoading(false);
    }
  }, [searchQuery]);

  const loadMoreAnime = useCallback(async () => {
    if (isLoadingMore || !hasMore || isSearching) return;
    if (!isMounted.current) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getAnimePaginated(nextPage, 24, ANIME_FIELDS);
      if (data?.length && isMounted.current) {
        setAnimeList(prev => [...prev, ...data]);
        setCurrentPage(nextPage);
        setHasMore(data.length === 24);
      } else {
        setHasMore(false);
      }
    } catch {
    } finally {
      if (isMounted.current) setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore, isSearching]);

  useEffect(() => {
    if (isMounted.current) {
      loadInitialAnime();
      if (!searchQuery) fetchFeaturedAnimes();
    }
  }, [filter, contentType]);

  useEffect(() => {
    if (!isMounted.current) return;

    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        if (searchQuery !== lastSearchQuery.current) {
          await loadInitialAnime(true);
          lastSearchQuery.current = searchQuery;
        }
      } else {
        if (lastSearchQuery.current !== '') {
          loadInitialAnime(false);
          fetchFeaturedAnimes();
          lastSearchQuery.current = '';
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, loadInitialAnime, fetchFeaturedAnimes]);

  const filteredAnime = useMemo(() => {
    if (!animeList.length) return [];
    
    let list = [...animeList];
    if (contentType !== 'All') list = list.filter(a => a.contentType === contentType);
    if (localFilter !== 'All') list = list.filter(a => a.subDubStatus === localFilter);

    const uniqueAnimesMap = new Map<string, Anime>();
    for (const anime of list) {
      const id = getAnimeId(anime);
      if (!uniqueAnimesMap.has(id)) uniqueAnimesMap.set(id, anime);
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

  useEffect(() => {
    if (isSearching) return;

    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;
      if (scrollTop + windowHeight >= docHeight * 0.8) loadMoreAnime();
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, isSearching, loadMoreAnime]);

  useEffect(() => {
    if (isMounted.current) setLocalFilter(filter);
  }, [filter]);

  if (isLoading && animeList.length === 0) {
    return (
      <>
        <SEO title="Loading... | AnimeBing" description="Watch anime online for free in Hindi and English. HD quality streaming and downloads." keywords="anime, watch anime online, hindi anime, english anime" />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 18 }).map((_, i) => <SkeletonLoader key={i} />)}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO title="Error Loading Anime | AnimeBing" description="Watch anime online for free in Hindi and English. HD quality streaming and downloads." keywords="anime, watch anime online, hindi anime, english anime" />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center p-4">
          <div className="text-center bg-purple-800/80 backdrop-blur rounded-2xl p-8 border border-purple-700">
            <p className="text-red-400 text-xl mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold">Try Again</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title={seoData.title} description={seoData.description} keywords={seoData.keywords} canonicalUrl={seoData.canonicalUrl} structuredData={seoData.structuredData} ogUrl={seoData.ogUrl} />
      
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900">
        <style>{`
          @keyframes subtle-glow { 0%,100% { opacity:0.4; filter:drop-shadow(0 0 10px currentColor); } 50% { opacity:0.6; filter:drop-shadow(0 0 25px currentColor); } }
          @keyframes shimmer { 0% { transform:translateX(-100%) rotate(45deg); } 100% { transform:translateX(100%) rotate(45deg); } }
          @keyframes float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-3px); } }
          @keyframes pulse-subtle { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.01); } }
          .enhanced-glow { animation:pulse-subtle 3s ease-in-out infinite; }
          .card-hover-effect:hover { transform:translateY(-4px) scale(1.01); transition:transform 0.3s ease-out; }
          .shimmer-effect { position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); animation:shimmer 3s infinite; }
          .sparkle-effect { animation:sparkle 2s ease-in-out infinite; }
          @keyframes sparkle { 0%,100% { opacity:0.2; transform:scale(0.8); } 50% { opacity:0.5; transform:scale(1.1); } }
          .border-transition { transition:background 0.8s ease-in-out; }
          .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
          .scrollbar-hide::-webkit-scrollbar { display:none; }
          .homepage-content-container { padding:0.5rem !important; margin:0.1rem !important; }
        `}</style>
        
        <div className="homepage-content-container mx-auto px-2 sm:px-3 py-2 lg:py-4">
          {!searchQuery && !isSearching && featuredAnimes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4 text-left">Latest Content</h2>
              <FeaturedAnimeCarousel featuredAnimes={featuredAnimes} onAnimeSelect={onAnimeSelect} />
            </div>
          )}

          {!searchQuery && !isSearching && isPollActive && pollChecked && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4 text-left">
                <span className="text-purple-300">🪶</span>
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mx-2">Community</span>
                <span className="text-purple-300">🪶</span>
              </h2>
              <PollCard onVoteSuccess={() => console.log('Vote submitted successfully!')} />
            </div>
          )}

          {!isSearching && (
            <div className="mb-2 lg:hidden">
              <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1.5 scrollbar-hide px-1">
                {filterButtons.map(btn => (
                  <button key={btn.key} onClick={() => handleFilterChange(btn.key)} className={`
                    px-4 py-2 rounded text-[10px] sm:text-[11px] font-medium transition-all duration-200 border whitespace-nowrap flex-shrink-0 min-w-[62px] sm:min-w-[68px]
                    ${localFilter === btn.key ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-lg shadow-blue-500/40' : 'bg-purple-800/90 text-purple-300 border-purple-700 hover:bg-purple-700/90'}
                  `}>{btn.label}</button>
                ))}
              </div>
            </div>
          )}

          {filteredAnime.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-purple-800/60 backdrop-blur rounded-2xl p-8 max-w-md mx-auto border border-purple-700">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-white mb-3">{searchQuery ? 'No Results Found' : 'No Content'}</h2>
                {!searchQuery && localFilter !== 'All' && (
                  <button onClick={() => handleFilterChange('All')} className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/40 text-white px-8 py-3 rounded-xl font-bold transition-all duration-300">Show All</button>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl lg:text-3xl font-bold mb-4 text-left">
                {headingData.emojiStart && <span className="text-purple-300 mr-2">{headingData.emojiStart}</span>}
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">{headingData.text}</span>
                {headingData.emojiEnd && <span className="text-purple-300 ml-2">{headingData.emojiEnd}</span>}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredAnime.map((anime, i) => (
                  <div key={`${getAnimeId(anime)}-${i}`} className="group relative">
                    <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br ${BORDER_COLORS[currentBorderColorIndex]} enhanced-glow border-transition`} style={{ backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}, ${GLOW_COLORS[currentBorderColorIndex][1]}, ${GLOW_COLORS[currentBorderColorIndex][2]})` }} />
                    <div className="absolute -inset-0 rounded-xl opacity-30 blur-md transition-all duration-500 group-hover:opacity-50" style={{ backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}40, ${GLOW_COLORS[currentBorderColorIndex][1]}40, ${GLOW_COLORS[currentBorderColorIndex][2]}40)` }} />
                    <div className="card-hover-effect relative rounded-xl border border-purple-700/30 bg-gradient-to-b from-purple-900/95 to-purple-800/90 p-1 transition-all duration-300 overflow-hidden group-hover:border-transparent">
                      <div className="shimmer-effect" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${GLOW_COLORS[currentBorderColorIndex][1]}20 0%, transparent 70%)` }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 via-transparent to-transparent opacity-40 group-hover:opacity-30 transition-opacity duration-300" />
                      <div className="absolute top-2 right-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30" style={{ background: GLOW_COLORS[currentBorderColorIndex][0], boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][0]}`, animationDelay: '0.2s' }} />
                      <div className="absolute bottom-2 left-2 w-1 h-1 rounded-full sparkle-effect opacity-0 group-hover:opacity-30" style={{ background: GLOW_COLORS[currentBorderColorIndex][1], boxShadow: `0 0 5px ${GLOW_COLORS[currentBorderColorIndex][1]}`, animationDelay: '0.5s' }} />
                      <AnimeCard anime={anime} onClick={onAnimeSelect} index={i} showStatus={true} />
                      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l rounded-tl-xl opacity-0 group-hover:opacity-70 transition-all duration-300" style={{ borderColor: GLOW_COLORS[currentBorderColorIndex][0] }} />
                      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r rounded-tr-xl opacity-0 group-hover:opacity-70 transition-all duration-300" style={{ borderColor: GLOW_COLORS[currentBorderColorIndex][1], animationDelay: '0.3s' }} />
                      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l rounded-bl-xl opacity-0 group-hover:opacity-70 transition-all duration-300" style={{ borderColor: GLOW_COLORS[currentBorderColorIndex][2], animationDelay: '0.6s' }} />
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r rounded-br-xl opacity-0 group-hover:opacity-70 transition-all duration-300" style={{ borderColor: GLOW_COLORS[currentBorderColorIndex][0], animationDelay: '0.9s' }} />
                      <div className="absolute -top-0.5 -left-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500" style={{ background: GLOW_COLORS[currentBorderColorIndex][0], boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][0]}`, animation: 'float 2s ease-in-out infinite' }} />
                      <div className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-75" style={{ background: GLOW_COLORS[currentBorderColorIndex][1], boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][1]}`, animation: 'float 2s ease-in-out infinite 0.5s' }} />
                      <div className="absolute -bottom-0.5 -left-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-150" style={{ background: GLOW_COLORS[currentBorderColorIndex][2], boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][2]}`, animation: 'float 2s ease-in-out infinite 1s' }} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-1 h-1 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 delay-225" style={{ background: GLOW_COLORS[currentBorderColorIndex][0], boxShadow: `0 0 6px ${GLOW_COLORS[currentBorderColorIndex][0]}`, animation: 'float 2s ease-in-out infinite 1.5s' }} />
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && !isSearching && !searchQuery && (
                <div className="text-center mt-8">
                  <button onClick={loadMoreAnime} disabled={isLoadingMore} className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60 transition-all duration-300 group" style={{ animation: 'pulse-subtle 4s ease-in-out infinite' }}>
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
                    <span className="relative z-10">{isLoadingMore ? <><span className="inline-block animate-spin mr-2">⟳</span>Loading...</> : 'Load More'}</span>
                  </button>
                </div>
              )}

              {isLoadingMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-700/10 to-transparent animate-shimmer" />
                      <SkeletonLoader />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default HomePage;