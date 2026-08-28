 // components/HomePage.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import FeaturedAnimeCarousel from '../src/components/FeaturedAnimeCarousel';
import SEO from '../src/components/SEO';
import PollCard from './PollCard';
import { useAnimeContext } from '../src/context/AnimeContext';
import AppDownloadPopup from './AppDownloadPopup';
import SpecialModeBanner from '../src/components/SpecialModeBanner'; // 🆕 Import
import { matchesContentTypeFilter } from '../src/utils/contentGroup';

interface Props {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  filter: FilterType;
  contentType: ContentTypeFilter;
}

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

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev';

const POLL_API_URL = `${API_BASE}/api/polls`;

const getAnimeId = (anime: Anime): string => {
  if (anime.id) return anime.id;
  if (anime._id) return anime._id;
  return `${anime.title}-${anime.releaseYear || 'unknown'}`;
};

const HomePage: React.FC<Props> = ({
  onAnimeSelect,
  searchQuery,
  filter: _filterProp,
  contentType: _contentTypeProp
}) => {
  const {
    animeList,
    featuredAnimes,
    isLoading,
    error,
    isLoadingMore,
    isSearching,
    hasMore,
    loadInitialAnime,
    loadMoreAnime,
    fetchFeatured,
    filter,
    setFilter,
    contentType,
    setContentType,
    setSearchQuery
  } = useAnimeContext();

  const isComingBackRef = useRef(!!sessionStorage.getItem('homeScrollPosition'));

  const [currentBorderColorIndex, setCurrentBorderColorIndex] = useState(0);
  const [isPollActive, setIsPollActive] = useState(false);
  const [pollChecked, setPollChecked] = useState(false);

  // URL is the single source of truth for filter / contentType.
  // Header.tsx (and this page's own mobile buttons) only ever change the URL —
  // never call setFilter/setContentType directly — so this effect is the ONLY
  // place that writes those values into context state.
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType | null;
    const urlContentType = searchParams.get('contentType') as ContentTypeFilter | null;

    const newFilter = urlFilter ?? 'All';
    const newContentType = urlContentType ?? 'All';

    if (filter !== newFilter) setFilter(newFilter);
    if (contentType !== newContentType) setContentType(newContentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // SCROLL RESTORATION
  useEffect(() => {
    if (animeList.length === 0) return;

    const savedPosition = sessionStorage.getItem('homeScrollPosition');
    if (!savedPosition) return;

    const position = parseInt(savedPosition, 10);

    sessionStorage.removeItem('homeScrollPosition');
    isComingBackRef.current = false;

    document.body.classList.add('skip-card-animations');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: position, behavior: 'instant' });
        document.body.classList.remove('skip-card-animations');
      });
    });

  }, [animeList.length]);

  // Sync searchQuery to context
  useEffect(() => {
    setSearchQuery(searchQuery);
  }, [searchQuery, setSearchQuery]);

  // Border color animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBorderColorIndex(prev => (prev + 1) % BORDER_COLORS.length);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Poll check
  const checkPollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${POLL_API_URL}/active?location=home`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      if (!res.ok) return false;
      const contentTypeHeader = res.headers.get('content-type');
      if (!contentTypeHeader || !contentTypeHeader.includes('application/json')) return false;
      const data = await res.json();
      const list = data.polls || (data.poll ? [data.poll] : []);
      return data.success && list.length > 0;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim() || isSearching) {
      setIsPollActive(false);
      setPollChecked(true);
      return;
    }
    const timer = setTimeout(async () => {
      const active = await checkPollStatus();
      setIsPollActive(active);
      setPollChecked(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery, isSearching, checkPollStatus]);

  // Focus handler
  useEffect(() => {
    const handleFocus = () => {
      if (!searchQuery) fetchFeatured();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [searchQuery, fetchFeatured]);

  // SEO
  const getSEOData = () => {
    let title = 'Watch Anime Online in Hindi & English | AnimeBing';
    let description = 'AnimeBing - Watch anime online for free in Hindi Dub, Hindi Sub, and English Sub. HD quality streaming and downloads.';
    let keywords = 'watch anime online, hindi anime, english anime, free anime streaming, anime download';
    if (searchQuery.trim()) {
      title = `Search "${searchQuery}" - Watch Anime Online | AnimeBing`;
      description = `Search results for "${searchQuery}". Watch anime online in Hindi and English.`;
      keywords = `${searchQuery} anime, ${searchQuery} hindi dub, ${searchQuery} english sub`;
    } else if (filter !== 'All') {
      if (filter === 'Hindi Dub') {
        title = 'Watch Hindi Dubbed Anime Online | AnimeBing';
        description = 'Watch Hindi dubbed anime online for free.';
        keywords = 'hindi dubbed anime, anime in hindi dub, free hindi anime';
      } else if (filter === 'Hindi Sub') {
        title = 'Watch Hindi Subbed Anime Online | AnimeBing';
        description = 'Watch Hindi subbed anime online for free.';
        keywords = 'hindi subbed anime, anime in hindi sub';
      } else if (filter === 'English Sub') {
        title = 'Watch English Subbed Anime Online | AnimeBing';
        description = 'Watch English subbed anime online for free.';
        keywords = 'english subbed anime, anime in english sub';
      }
    } else if (contentType !== 'All') {
      if (contentType === 'Movie') {
        title = 'Watch Anime Movies Online | AnimeBing';
        description = 'Watch anime movies online for free in Hindi and English.';
        keywords = 'anime movies, watch anime movies online';
      } else if (contentType === 'Manga') {
        title = 'Read Manga Online | AnimeBing';
        description = 'Read manga online for free.';
        keywords = 'read manga online, manga, free manga';
      }
    }
    let canonicalUrl = 'https://animebing.in';
    const params = new URLSearchParams();
    if (filter !== 'All') params.set('filter', filter);
    if (contentType !== 'All') params.set('contentType', contentType);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (params.toString()) canonicalUrl += `?${params.toString()}`;
    return { title, description, keywords, canonicalUrl, ogUrl: window.location.href, structuredData: {} };
  };
  const seoData = getSEOData();

  // Heading
  const getHeading = () => {
    if (isSearching && searchQuery) return `Search: ${searchQuery}`;
    if (contentType !== 'All') return `All ${contentType}`;
    switch (filter) {
      case 'Hindi Dub': return 'All Hindi Dub';
      case 'Hindi Sub': return 'All Hindi Sub';
      case 'English Sub': return 'All English Sub';
      default: return 'All Anime,Movie,Manhwa';
    }
  };

  const filterButtons = [
    { key: 'All' as FilterType, label: 'All' },
    { key: 'Hindi Dub' as FilterType, label: 'Hindi Dub' },
    { key: 'Hindi Sub' as FilterType, label: 'Hindi Sub' },
    { key: 'English Sub' as FilterType, label: 'English Sub' }
  ];

  // Mobile filter buttons: also go through the URL, same as Header,
  // so there is exactly one place (the effect above) that ever sets state.
  const handleFilterChange = (f: FilterType) => {
    const params = new URLSearchParams(searchParams);
    if (f === 'All') {
      params.delete('filter');
    } else {
      params.set('filter', f);
    }
    setSearchParams(params);
  };

  // Filtered list with case-insensitive contentType check
  const filteredAnime = useMemo(() => {
    if (!animeList.length) return [];
    let list = [...animeList];

    if (contentType !== 'All') {
      list = list.filter(a => matchesContentTypeFilter(a.contentType, contentType));
    }

    if (filter !== 'All') list = list.filter(a => a.subDubStatus === filter);
    const uniqueMap = new Map<string, Anime>();
    list.forEach(a => uniqueMap.set(getAnimeId(a), a));
    return Array.from(uniqueMap.values());
  }, [animeList, filter, contentType]);

  // ✅ Mobile browsers (especially with a transformed fixed header) sometimes skip
  // repainting this section after a filter change until a scroll event fires.
  // This forces a repaint immediately after the filtered list updates.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.scrollBy(0, 1);
      window.scrollBy(0, -1);
    });
    return () => cancelAnimationFrame(raf);
  }, [filter, contentType, filteredAnime.length]);

  // Infinite scroll
  useEffect(() => {
    if (isSearching) return;
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      if (window.scrollY + window.innerHeight >= document.documentElement.offsetHeight * 0.2) {
        loadMoreAnime();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, isSearching, loadMoreAnime]);

  if (isLoading && animeList.length === 0 && !isComingBackRef.current) {
    return (
      <>
        <SEO {...seoData} />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-3">
            {Array.from({ length: 18 }).map((_, i) => <SkeletonLoader key={i} />)}
          </div>
        </div>
      </>
    );
  }

  if (isLoading && animeList.length === 0 && isComingBackRef.current) {
    return (
      <>
        <SEO {...seoData} />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900" />
      </>
    );
  }

  if (error && animeList.length === 0) {
    return (
      <>
        <SEO {...seoData} />
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center p-4">
          <div className="text-center bg-purple-800/80 backdrop-blur rounded-2xl p-8 border border-purple-700">
            <p className="text-red-400 text-xl mb-4">{error}</p>
            <button
              onClick={() => loadInitialAnime(false)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold"
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO {...seoData} />
      <AppDownloadPopup />
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900">
        <style>{`
          body.skip-card-animations .card-load-animate {
            opacity: 1 !important;
            animation: none !important;
          }
          @keyframes shimmer {
            0% { transform:translateX(-100%) rotate(45deg); }
            100% { transform:translateX(100%) rotate(45deg); }
          }
          @keyframes float {
            0%,100% { transform:translateY(0px); }
            50% { transform:translateY(-3px); }
          }
          .card-hover-effect:hover { transform:translateY(-4px) scale(1.01); transition:transform 0.3s ease-out; }
          .border-transition { transition:background 0.8s ease-in-out; }
          .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
          .scrollbar-hide::-webkit-scrollbar { display:none; }
          .homepage-content-container { padding:0.5rem !important; margin:0.1rem !important; }
        `}</style>

        <div className="homepage-content-container mx-auto px-2 sm:px-3 py-2 lg:py-4">

          {!searchQuery && !isSearching && (
            <SpecialModeBanner location="home" className="mb-6" />
          )}

          {!searchQuery && !isSearching && featuredAnimes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4 text-left">
                Latest Content
              </h2>
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
              <PollCard onVoteSuccess={() => {}} location="home" />
            </div>
          )}

          {!isSearching && (
            <div className="mb-2 lg:hidden">
              <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1.5 scrollbar-hide px-1">
                {filterButtons.map(btn => (
                  <button
                    key={btn.key}
                    onClick={() => handleFilterChange(btn.key)}
                    className={`
                      px-4 py-2 rounded text-[10px] sm:text-[11px] font-medium transition-all duration-200
                      border whitespace-nowrap flex-shrink-0 min-w-[62px] sm:min-w-[68px]
                      ${filter === btn.key
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-lg shadow-blue-500/40'
                        : 'bg-purple-800/90 text-purple-300 border-purple-700 hover:bg-purple-700/90'
                      }
                    `}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredAnime.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-purple-800/60 backdrop-blur rounded-2xl p-8 max-w-md mx-auto border border-purple-700">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {searchQuery ? 'No Results Found' : 'No Content'}
                </h2>
                {!searchQuery && filter !== 'All' && (
                  <button
                    onClick={() => handleFilterChange('All')}
                    className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/40 text-white px-8 py-3 rounded-xl font-bold"
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
          ) : (
            <React.Fragment key={`${filter}-${contentType}-${searchQuery}`}>
              <h2 className="text-2xl lg:text-3xl font-bold mb-4 text-left">
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  {getHeading()}
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2">
                {filteredAnime.map((anime, i) => (
                  <div key={`${getAnimeId(anime)}-${i}`} className="group relative">
                    <div
                      className={`absolute -inset-[1px] rounded-xl border-transition`}
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${GLOW_COLORS[currentBorderColorIndex][0]}, ${GLOW_COLORS[currentBorderColorIndex][1]}, ${GLOW_COLORS[currentBorderColorIndex][2]})`
                      }}
                    />
                    <div className="card-hover-effect relative rounded-xl border border-purple-700/30 bg-gradient-to-b from-purple-900/95 to-purple-800/90 p-1 transition-all duration-300 overflow-hidden group-hover:border-transparent">
                      <AnimeCard
                        anime={anime}
                        onClick={onAnimeSelect}
                        index={i}
                        showStatus={true}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && !isSearching && !searchQuery && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMoreAnime}
                    disabled={isLoadingMore}
                    className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60 transition-all duration-300"
                  >
                    <span className="relative z-10">
                      {isLoadingMore
                        ? <><span className="inline-block animate-spin mr-2">⟳</span>Loading...</>
                        : 'Load More'
                      }
                    </span>
                  </button>
                </div>
              )}

              {isLoadingMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2 mt-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="relative rounded-xl border border-purple-700/40 p-1 bg-gradient-to-b from-purple-900/80 to-purple-800/70 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-700/10 to-transparent animate-shimmer" />
                      <SkeletonLoader />
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          )}
        </div>
      </div>
    </>
  );
};

export default HomePage;