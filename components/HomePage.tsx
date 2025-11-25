  // components/HomePage.tsx - UPDATED WITH CONSISTENT PLAY ICON
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Anime, FilterType, ContentTypeFilter } from '../src/types';
import AnimeCard from './AnimeCard';
import { SkeletonLoader } from './SkeletonLoader';
import Spinner from './Spinner';
import { getAllAnime, searchAnime } from '../services/animeService';

interface Props {
  onAnimeSelect: (anime: Anime) => void;
  searchQuery: string;
  filter: FilterType;
  contentType: ContentTypeFilter;
}

const HomePage: React.FC<Props> = ({ 
  onAnimeSelect, 
  searchQuery, 
  filter, 
  contentType 
}) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dailyAnime, setDailyAnime] = useState<Anime[]>([]);
  const [slideDirection, setSlideDirection] = useState(0);

  // ✅ DAILY ANIME SELECTION
  const getDailyAnime = useCallback((allAnime: Anime[]): Anime[] => {
    if (allAnime.length === 0) return [];
    
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    const seededRandom = (index: number) => {
      const x = Math.sin(seed + index * 100) * 10000;
      return Math.abs((x - Math.floor(x)) * 10000);
    };

    const shuffled = [...allAnime];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(i) % (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const count = Math.min(18, shuffled.length);
    return shuffled.slice(0, count);
  }, []);

  // ✅ AUTO SLIDE CONFIGURATION
  const SLIDE_INTERVAL = 5000;
  const MOBILE_CARDS_PER_SLIDE = 3;
  const DESKTOP_CARDS_PER_SLIDE = 6;

  useEffect(() => {
    const loadInitialAnime = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAllAnime();
        
        if (!data || data.length === 0) {
          setError('No anime data available');
          return;
        }
        
        setAnimeList(data);
        const dailySelection = getDailyAnime(data);
        setDailyAnime(dailySelection);
        
      } catch (err) {
        console.error('Error loading anime:', err);
        setError('Failed to load anime data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialAnime();
  }, [getDailyAnime]);

  // ✅ GET CARDS PER SLIDE
  const getCardsPerSlide = useCallback(() => {
    if (typeof window === 'undefined') return MOBILE_CARDS_PER_SLIDE;
    return window.innerWidth >= 1024 ? DESKTOP_CARDS_PER_SLIDE : MOBILE_CARDS_PER_SLIDE;
  }, []);

  const [cardsPerSlide, setCardsPerSlide] = useState(getCardsPerSlide());

  // ✅ HANDLE RESIZE
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newCardsPerSlide = getCardsPerSlide();
        setCardsPerSlide(newCardsPerSlide);
        setCurrentSlide(0);
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [getCardsPerSlide]);

  // ✅ AUTO SLIDE EFFECT
  useEffect(() => {
    if (dailyAnime.length <= cardsPerSlide) return;

    const interval = setInterval(() => {
      setSlideDirection(1);
      setCurrentSlide(prev => {
        const totalSlides = Math.ceil(dailyAnime.length / cardsPerSlide);
        return (prev + 1) % totalSlides;
      });
    }, SLIDE_INTERVAL);

    return () => clearInterval(interval);
  }, [dailyAnime.length, cardsPerSlide]);

  // ✅ SEARCH FUNCTIONALITY
  useEffect(() => {
    const abortController = new AbortController();

    const performSearch = async () => {
      if (searchQuery.trim() === '') {
        try {
          const data = await getAllAnime();
          setAnimeList(data);
          const dailySelection = getDailyAnime(data);
          setDailyAnime(dailySelection);
        } catch (err) {
          if (!abortController.signal.aborted) {
            setError('Failed to load anime data');
          }
        }
        return;
      }

      try {
        setIsLoading(true);
        const data = await searchAnime(searchQuery);
        if (!abortController.signal.aborted) {
          setAnimeList(data);
          const dailySelection = getDailyAnime(data);
          setDailyAnime(dailySelection);
          setError(null);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError('Search failed. Please try again.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    
    return () => {
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, getDailyAnime]);

  // ✅ FILTER LOGIC
  const filteredAnime = useMemo(() => {
    let filtered = [...animeList];

    if (contentType !== 'All') {
      filtered = filtered.filter(anime => 
        anime.contentType === contentType
      );
    }

    if (filter !== 'All') {
      filtered = filtered.filter(anime => 
        anime.subDubStatus === filter
      );
    }

    return filtered;
  }, [animeList, filter, contentType]);

  // ✅ CURRENT SLIDING ANIME
  const currentAnimeSlide = useMemo(() => {
    const start = currentSlide * cardsPerSlide;
    const end = start + cardsPerSlide;
    const slideAnime = dailyAnime.slice(start, end);
    
    if (slideAnime.length < cardsPerSlide) {
      const remaining = cardsPerSlide - slideAnime.length;
      const extraAnime = dailyAnime.slice(0, remaining);
      return [...slideAnime, ...extraAnime];
    }
    
    return slideAnime;
  }, [dailyAnime, currentSlide, cardsPerSlide]);

  // ✅ FILTER BUTTONS
  const filterButtons = [
    { key: 'All' as FilterType, label: 'All' },
    { key: 'Hindi Dub' as FilterType, label: 'Hindi Dub' },
    { key: 'Hindi Sub' as FilterType, label: 'Hindi Sub' },
    { key: 'English Sub' as FilterType, label: 'English Sub' }
  ];

  // ✅ HANDLE FILTER CHANGE
  const handleFilterChange = (newFilter: FilterType) => {
    const url = new URL(window.location.href);
    if (newFilter === 'All') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', newFilter);
    }
    window.location.href = url.toString();
  };

  // ✅ MANUAL SLIDE CONTROLS
  const nextSlide = useCallback(() => {
    if (dailyAnime.length <= cardsPerSlide) return;
    setSlideDirection(1);
    const totalSlides = Math.ceil(dailyAnime.length / cardsPerSlide);
    setCurrentSlide(prev => (prev + 1) % totalSlides);
  }, [dailyAnime.length, cardsPerSlide]);

  const prevSlide = useCallback(() => {
    if (dailyAnime.length <= cardsPerSlide) return;
    setSlideDirection(-1);
    const totalSlides = Math.ceil(dailyAnime.length / cardsPerSlide);
    setCurrentSlide(prev => (prev - 1 + totalSlides) % totalSlides);
  }, [dailyAnime.length, cardsPerSlide]);

  // ✅ Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide]);

  const totalSlides = Math.ceil(dailyAnime.length / cardsPerSlide);

  if (isLoading && animeList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">
            {searchQuery ? 'Searching...' : 'Latest Content'}
          </h1>
          <div className="space-y-8">
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-4">
              {Array.from({ length: cardsPerSlide }).map((_, index) => (
                <SkeletonLoader key={index} type="card" />
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 lg:gap-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <SkeletonLoader key={index} type="card" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="bg-red-900/20 rounded-xl p-8 max-w-md mx-auto border border-red-500/30">
              <div className="text-6xl mb-4">😞</div>
              <h2 className="text-2xl font-semibold text-white mb-2">Error Loading Anime</h2>
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-2 rounded-lg transition-all duration-300 font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-4 lg:py-8">
        
        {/* ✅ MOBILE FILTER BUTTONS */}
        <div className="mb-4 lg:hidden">
          <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {filterButtons.map((filterBtn) => (
              <button
                key={filterBtn.key}
                onClick={() => handleFilterChange(filterBtn.key)}
                className={`
                  px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 
                  border shadow-sm hover:shadow whitespace-nowrap flex-shrink-0
                  transform hover:scale-102 active:scale-98 min-w-[60px]
                  ${filter === filterBtn.key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-blue-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:border-slate-500 hover:bg-slate-700/80'
                  }
                `}
              >
                {filterBtn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ✅ MAIN CONTENT HEADING */}
        <div className="mb-4 lg:mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            {contentType === 'All' ? 'Latest Content' : `Latest ${contentType}`}
          </h2>
        </div>

        {/* ✅ UPDATED: SLIDING SECTION WITH CONSISTENT PLAY ICON */}
        {dailyAnime.length > 0 && (
          <div className="relative mb-8 lg:mb-12">
            <div className="w-full">
              {/* SLIDER CONTROLS */}
              {dailyAnime.length > cardsPerSlide && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 text-white p-2 lg:p-3 rounded-full transition-all duration-200 -ml-2 lg:-ml-6 shadow-2xl hover:scale-110 active:scale-95"
                    aria-label="Previous slide"
                  >
                    ‹
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 text-white p-2 lg:p-3 rounded-full transition-all duration-200 -mr-2 lg:-mr-6 shadow-2xl hover:scale-110 active:scale-95"
                    aria-label="Next slide"
                  >
                    ›
                  </button>
                </>
              )}

              {/* ANIME CARDS GRID */}
              <div className={`grid gap-2 lg:gap-4 px-1 ${
                cardsPerSlide === 6 
                  ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' 
                  : 'grid-cols-3'
              }`}>
                {currentAnimeSlide.map((anime, index) => (
                  <div 
                    key={`${anime.id}-${currentSlide}-${index}`}
                    className={`
                      transform transition-all duration-500 ease-out
                      ${slideDirection === 1 ? 'animate-slide-in-right' : ''}
                      ${slideDirection === -1 ? 'animate-slide-in-left' : ''}
                    `}
                  >
                    {/* ✅ UPDATED: ANIME CARD WITH CONSISTENT PLAY ICON */}
                    <div 
                      className="cursor-pointer rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full h-full group"
                      onClick={() => onAnimeSelect(anime)}
                    >
                      <div className={`relative h-full ${
                        cardsPerSlide === 6 ? 'aspect-[2/3]' : 'aspect-[3/4]'
                      }`}>
                        <img
                          src={anime.thumbnail}
                          alt={anime.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/images/fallback-thumbnail.jpg';
                          }}
                        />
                        
                        {/* GRADIENT OVERLAY */}
                        <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col justify-end ${
                          cardsPerSlide === 6 ? 'p-3 lg:p-4' : 'p-2'
                        } group-hover:bg-black/70 transition-all duration-300`}>
                          
                          {/* CONTENT */}
                          <div className="transform transition-transform duration-300">
                            {/* TITLE */}
                            <h3 className={`text-white font-bold line-clamp-2 drop-shadow-lg leading-tight ${
                              cardsPerSlide === 6 
                                ? 'text-sm lg:text-base mb-1 lg:mb-2' 
                                : 'text-xs mb-1'
                            }`}>
                              {anime.title}
                            </h3>
                            
                            {/* DETAILS */}
                            <div className="flex items-center justify-between">
                              <p className={`text-slate-300 ${
                                cardsPerSlide === 6 ? 'text-sm' : 'text-[10px]'
                              }`}>
                                {anime.releaseYear}
                              </p>
                              <span className={`bg-purple-600 text-white font-semibold rounded ${
                                cardsPerSlide === 6 
                                  ? 'text-xs px-2 py-1' 
                                  : 'text-[10px] px-1 py-0.5 whitespace-nowrap'
                              }`}>
                                {anime.subDubStatus}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ✅ UPDATED: CONSISTENT PLAY ICON - SAME AS ANIMECARD COMPONENT */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50">
                          <div className="transform transition-transform duration-300 group-hover:scale-110">
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-3 shadow-2xl border-2 border-white/20">
                              <div className="bg-white rounded-full flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14">
                                <span className="text-purple-600 font-bold text-lg lg:text-xl">
                                  ▶
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SLIDE INDICATORS */}
              {totalSlides > 1 && (
                <div className="flex justify-center mt-4 space-x-1">
                  {Array.from({ length: totalSlides }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSlideDirection(index > currentSlide ? 1 : -1);
                        setCurrentSlide(index);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        currentSlide === index 
                          ? 'bg-white w-4' 
                          : 'bg-gray-500 hover:bg-gray-300'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ ALL CONTENT SECTION */}
        {filteredAnime.length === 0 ? (
          <div className="text-center py-8 lg:py-16">
            <div className="bg-slate-800/50 rounded-xl p-6 lg:p-8 max-w-md mx-auto border border-slate-700">
              <div className="text-4xl lg:text-6xl mb-3 lg:mb-4">🔍</div>
              <h2 className="text-xl lg:text-2xl font-semibold text-slate-300 mb-2">
                {searchQuery ? 'No Results Found' : 'No Anime Available'}
              </h2>
              <p className="text-slate-400 text-sm lg:text-base">
                {searchQuery 
                  ? `No results for "${searchQuery}"`
                  : 'Check back later for new content'
                }
              </p>
              {filter !== 'All' && (
                <div className="mt-3 lg:mt-4">
                  <button
                    onClick={() => handleFilterChange('All')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-lg transition-all duration-300 font-medium text-sm lg:text-base shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Show All Content
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ALL ANIME GRID */}
            <div className="mt-6 lg:mt-8">
              <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-3 lg:mb-4">
                All Content
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 lg:gap-3">
                {filteredAnime.map((anime, index) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onClick={onAnimeSelect}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;
