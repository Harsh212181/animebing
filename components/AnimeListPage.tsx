  import React, { useState, useEffect, useMemo } from 'react';
import type { Anime, FilterType } from '../src/types';
import { getAllAnime } from '../services/animeService';
import Spinner from './Spinner';

interface AnimeListPageProps {
  onAnimeSelect: (anime: Anime) => void;
}

const AnimeListPage: React.FC<AnimeListPageProps> = ({ onAnimeSelect }) => {
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localFilter, setLocalFilter] = useState<FilterType>('All');

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAllAnime();
        setAllAnime(data);
      } catch (err) {
        setError('Failed to fetch anime data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnime();
  }, []);

  const sortedAndFilteredAnime = useMemo(() => {
    let result = allAnime;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(anime => 
        anime.title.toLowerCase().includes(query)
      );
    }
    
    // Apply type filter - use LOCAL filter only
    if (localFilter !== 'All') {
      result = result.filter(anime => anime.subDubStatus === localFilter);
    }
    
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [allAnime, localFilter, searchQuery]);

  // Effect to manage the filtering loading indicator for a smoother UX
  useEffect(() => {
    if (isFiltering) {
      const timer = setTimeout(() => setIsFiltering(false), 300);
      return () => clearTimeout(timer);
    }
  }, [sortedAndFilteredAnime, isFiltering]);

  const handleFilterChange = (newFilter: FilterType) => {
    if (newFilter !== localFilter) {
      setIsFiltering(true);
      setLocalFilter(newFilter);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsFiltering(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsFiltering(true);
  };

  const filterOptions: FilterType[] = ['All', 'Hindi Dub', 'Hindi Sub', 'English Sub'];

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-slate-100 border-l-4 border-purple-500 pl-4">
          Anime List
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Buttons - Smaller buttons without scrollbar */}
          <div className="flex overflow-x-auto gap-1 bg-slate-800/50 p-1 rounded-lg w-full sm:w-auto 
                          [-ms-overflow-style:none] [scrollbar-width:none] 
                          [&::-webkit-scrollbar]:hidden">
            {filterOptions.map(option => (
              <button
                key={option}
                onClick={() => handleFilterChange(option)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                  localFilter === option
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      )}
      {error && <p className="text-center text-red-400">{error}</p>}
      
      {!isLoading && !error && (
        <div className="bg-slate-800/50 rounded-lg shadow-lg relative min-h-[300px]">
          {isFiltering && (
            <div className="absolute inset-0 bg-slate-800/60 flex justify-center items-center z-10 rounded-lg animate-fade-in">
              <Spinner />
            </div>
          )}
          <ul className={`divide-y divide-slate-700 transition-opacity duration-300 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
            {sortedAndFilteredAnime.length > 0 ? (
              sortedAndFilteredAnime.map(anime => (
                <li key={anime.id}>
                  <button 
                    onClick={() => onAnimeSelect(anime)}
                    className="w-full text-left p-4 flex items-center hover:bg-slate-700/50 transition-colors duration-200 group"
                  >
                    {/* Updated: Smaller font size and better word break for mobile */}
                    <span className="text-slate-200 group-hover:text-purple-300 transition-colors pr-2 text-sm md:text-base break-words flex-1 min-w-0">
                      {anime.title}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                      {anime.subDubStatus}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="p-8 text-center text-slate-400">
                {searchQuery 
                  ? `No anime found matching "${searchQuery}"`
                  : 'No anime found for the selected filter.'
                }
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnimeListPage;
