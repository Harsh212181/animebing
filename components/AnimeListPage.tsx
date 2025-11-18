 import React, { useState, useEffect, useMemo } from 'react';
import type { Anime, FilterType } from '../src/types';
import { getAllAnime } from '../services/animeService';
import Spinner from './Spinner';
import AdSlot from './AdSlot'; // Assuming AdSlot is imported; adjust path if needed

interface AnimeListPageProps {
  onAnimeSelect: (anime: Anime) => void;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
}

const AnimeListPage: React.FC<AnimeListPageProps> = ({ onAnimeSelect, filter, setFilter }) => {
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (filter !== 'All') {
      result = result.filter(anime => anime.subDubStatus === filter);
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [allAnime, filter]);

  // Effect to manage the filtering loading indicator for a smoother UX
  useEffect(() => {
    if (isFiltering) {
      const timer = setTimeout(() => setIsFiltering(false), 300); // Simulate loading for better feedback
      return () => clearTimeout(timer);
    }
  }, [sortedAndFilteredAnime, isFiltering]);

  const handleFilterChange = (newFilter: FilterType) => {
    if (newFilter !== filter) {
      setIsFiltering(true);
      setFilter(newFilter);
    }
  };

  const filterOptions: FilterType[] = ['All', 'Hindi Dub', 'Hindi Sub'];

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-slate-100 border-l-4 border-purple-500 pl-4">
          Anime List (A-Z)
        </h1>
        <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg">
          {filterOptions.map(option => (
            <button
              key={option}
              onClick={() => handleFilterChange(option)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === option
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Ad before anime list */}
      <div className="mb-6 hidden lg:block">
        <AdSlot position="in_content" />
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
                    className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-700/50 transition-colors duration-200 group"
                  >
                    <span className="text-slate-200 group-hover:text-purple-300 transition-colors">{anime.title}</span>
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">{anime.subDubStatus}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="p-8 text-center text-slate-400">
                No anime found for the selected filter.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnimeListPage;