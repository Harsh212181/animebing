// src/components/admin/SearchableDropdown.tsx - COMPLETE SEARCHABLE DROPDOWN
import React, { useState, useRef, useEffect } from 'react';
import type { Anime } from '../../types';

interface SearchableDropdownProps {
  animes: Anime[];
  selectedAnime: Anime | null;
  onAnimeSelect: (anime: Anime | null) => void;
  loading?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  animes,
  selectedAnime,
  onAnimeSelect,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter animes based on search
  const filteredAnimes = animes.filter(anime =>
    anime.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (anime: Anime) => {
    onAnimeSelect(anime);
    setSearchTerm(anime.title);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const clearSelection = () => {
    onAnimeSelect(null);
    setSearchTerm('');
  };

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Type to search anime..."
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors pr-10"
        />
        
        {/* Clear Button */}
        {selectedAnime && (
          <button
            onClick={clearSelection}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-400">
              Loading animes...
            </div>
          ) : filteredAnimes.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              {searchTerm ? 'No animes found' : 'No animes available'}
            </div>
          ) : (
            filteredAnimes.map(anime => (
              <button
                key={anime.id}
                onClick={() => handleSelect(anime)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                  selectedAnime?.id === anime.id ? 'bg-purple-600 text-white' : 'text-slate-300'
                }`}
              >
                <div className="font-medium">{anime.title}</div>
                <div className="text-sm text-slate-400">
                  {anime.episodes?.length || 0} episodes • {anime.status}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected Anime Info */}
      {selectedAnime && !isOpen && (
        <div className="mt-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-white">{selectedAnime.title}</h4>
              <p className="text-slate-300 text-sm">
                {selectedAnime.episodes?.length || 0} episodes • {selectedAnime.status}
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;