  // components/HomePage.tsx - UPDATED WITH BUTTONS ABOVE HEADING
import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    const loadInitialAnime = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAllAnime();
        setAnimeList(data);
        console.log('🏠 HomePage: Anime loaded with latest first sorting');
      } catch (err) {
        setError('Failed to load anime data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialAnime();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim() === '') {
        const data = await getAllAnime();
        setAnimeList(data);
        return;
      }

      try {
        setIsLoading(true);
        const data = await searchAnime(searchQuery);
        setAnimeList(data);
      } catch (err) {
        setError('Search failed');
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ✅ UPDATED: Filter logic now includes English Sub
  const filteredAnime = useMemo(() => {
    let filtered = [...animeList];

    // Content type filter
    if (contentType !== 'All') {
      filtered = filtered.filter(anime => 
        anime.contentType === contentType
      );
    }

    // Dub/Sub filter - NOW INCLUDES ENGLISH SUB
    if (filter !== 'All') {
      filtered = filtered.filter(anime => 
        anime.subDubStatus === filter
      );
    }

    return filtered;
  }, [animeList, filter, contentType]);

  // ✅ FILTER BUTTONS FOR MOBILE - WITHOUT EMOJIS
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">
            {searchQuery ? 'Searching...' : 'Latest Content'}
          </h1>
          <SkeletonLoader type="card" count={12} />
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
      <div className="container mx-auto px-4 py-8">
        {/* ✅ MOBILE FILTER BUTTONS - ABOVE HEADING */}
        <div className="lg:hidden mb-4">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 justify-center">
            {filterButtons.map((filterBtn) => (
              <button
                key={filterBtn.key}
                onClick={() => handleFilterChange(filterBtn.key)}
                className={`
                  px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 
                  border shadow-lg hover:shadow-xl whitespace-nowrap flex-shrink-0
                  ${filter === filterBtn.key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-blue-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-400 hover:bg-slate-700'
                  }
                `}
              >
                {filterBtn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ✅ HEADING SECTION - BUTTONS KE NEECHE */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            {contentType === 'All' ? 'Latest Content' : `Latest ${contentType}`}
          </h1>
        </div>

        {filteredAnime.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto border border-slate-700">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-semibold text-slate-300 mb-2">
                {searchQuery ? 'No Results Found' : 'No Anime Available'}
              </h2>
              <p className="text-slate-400">
                {searchQuery 
                  ? `No results for "${searchQuery}"`
                  : 'Check back later for new content'
                }
              </p>
              {filter !== 'All' && (
                <div className="mt-4">
                  <button
                    onClick={() => handleFilterChange('All')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-lg transition-all duration-300 font-medium shadow-lg"
                  >
                    Show All Content
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
            {filteredAnime.map((anime, index) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onClick={onAnimeSelect}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
