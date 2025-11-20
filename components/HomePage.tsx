 // components/HomePage.tsx - CORRECTED VERSION
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

  // ✅ INITIAL LOAD - ONLY ON MOUNT
  useEffect(() => {
    const loadInitialAnime = async () => {
      try {
        console.log('🏠 HomePage: Initial load starting...');
        setIsLoading(true);
        setError(null);
        
        const data = await getAllAnime();
        console.log('🏠 HomePage: Initial data loaded:', data.length, 'items');
        
        setAnimeList(data);
      } catch (err) {
        console.error('🏠 HomePage: Initial load error:', err);
        setError('Failed to load anime data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialAnime();
  }, []); // ✅ EMPTY DEPENDENCY - ONLY RUN ONCE

  // ✅ SEARCH EFFECT - RUNS WHEN searchQuery CHANGES
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim() === '') {
        // Empty search - reload all anime
        console.log('🏠 HomePage: Empty search, reloading all anime');
        const data = await getAllAnime();
        setAnimeList(data);
        return;
      }

      try {
        console.log('🏠 HomePage: Performing search for:', searchQuery);
        setIsLoading(true);
        
        const data = await searchAnime(searchQuery);
        console.log('🏠 HomePage: Search results:', data.length, 'items');
        
        setAnimeList(data);
      } catch (err) {
        console.error('🏠 HomePage: Search error:', err);
        setError('Search failed');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ✅ FILTER ANIME BASED ON CURRENT STATE
  const filteredAnime = useMemo(() => {
    console.log('🏠 HomePage: Filtering anime...', {
      total: animeList.length,
      searchQuery,
      filter,
      contentType
    });

    let filtered = [...animeList];

    // Content type filter
    if (contentType !== 'All') {
      filtered = filtered.filter(anime => 
        anime.contentType === contentType
      );
    }

    // Dub/Sub filter
    if (filter !== 'All') {
      filtered = filtered.filter(anime => 
        anime.subDubStatus === filter
      );
    }

    console.log('🏠 HomePage: After filtering:', filtered.length, 'items');
    return filtered;
  }, [animeList, filter, contentType]);

  // ✅ RENDER LOGIC
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          {searchQuery ? 'Searching...' : 'Latest Anime'}
        </h1>
        <SkeletonLoader type="card" count={12} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <div className="bg-red-900/20 rounded-xl p-8 max-w-md mx-auto">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-2xl font-semibold text-white mb-2">Error Loading Anime</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('🏠 HomePage: Rendering with', filteredAnime.length, 'anime');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">
          {contentType === 'All' ? 'Latest Content' : `Latest ${contentType}`}
          {filteredAnime.length > 0 && (
            <span className="text-slate-400 text-lg ml-2">
              ({filteredAnime.length} items)
            </span>
          )}
        </h1>
      </div>

      {/* Debug Info */}
      <div className="bg-slate-800/50 p-4 rounded-lg mb-6">
        <h3 className="text-yellow-400 font-semibold mb-2">🔍 Debug Info:</h3>
        <p className="text-slate-300 text-sm">
          Total Anime: {animeList.length} | 
          Showing: {filteredAnime.length} | 
          Search: "{searchQuery}" | 
          Filter: {filter} | 
          Type: {contentType}
        </p>
      </div>

      {filteredAnime.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto">
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
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
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
  );
};

export default HomePage;
