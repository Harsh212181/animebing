 // src/components/admin/SearchableDropdown.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Anime } from '../../types';
import axios from 'axios';

// ✅ Default to empty string – let the environment or parent decide
const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const getToken = () => localStorage.getItem('adminToken') || '';

const debounce = (fn: Function, delay: number) => {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

interface AsyncSearchProps {
  onSelect?: (item: Anime) => void;
  placeholder?: string;
  disabled?: boolean;
  fetchUrl?: string;
  apiBase?: string;
  token?: string;
  autoFocus?: boolean;
}

interface LocalListProps {
  animes?: Anime[];
  selectedAnime?: Anime | null;
  onAnimeSelect?: (anime: Anime | null) => void;
  loading?: boolean;
}

type SearchableDropdownProps = LocalListProps & AsyncSearchProps;

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  animes,
  selectedAnime,
  onAnimeSelect,
  loading: localLoading,
  onSelect,
  placeholder = 'Type to search...',
  disabled = false,
  fetchUrl = '/api/anime/unassigned',  // fallback only – should be overridden
  apiBase,
  token,
  autoFocus = false,
}) => {
  const isAsyncMode = !!onSelect;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [asyncResults, setAsyncResults] = useState<Anime[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [selectedAsyncAnime, setSelectedAsyncAnime] = useState<Anime | null>(null);

  const filteredAnimes = isAsyncMode
    ? asyncResults
    : animes?.filter(anime =>
        anime.title.toLowerCase().includes(searchTerm.toLowerCase())
      ) || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAsyncResults = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setAsyncResults([]);
        setAsyncLoading(false);
        return;
      }
      setAsyncLoading(true);
      setAsyncError(null);
      try {
        const base = apiBase || DEFAULT_API_BASE;
        const authToken = token || getToken();

        // ✅ Cleanly join base and fetchUrl – avoid double slashes
        const url = new URL(fetchUrl, base || window.location.origin).toString();

        const response = await axios.get(url, {
          params: { search: query },   // ✅ always send ?search=...
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setAsyncResults(response.data);
      } catch (err: any) {
        console.error('SearchableDropdown fetch error:', err);
        setAsyncError(err.response?.data?.error || 'Failed to search');
        setAsyncResults([]);
      } finally {
        setAsyncLoading(false);
      }
    }, 500),
    [apiBase, token, fetchUrl]
  );

  useEffect(() => {
    if (isAsyncMode) {
      fetchAsyncResults(searchTerm);
    }
  }, [searchTerm, isAsyncMode, fetchAsyncResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (!isAsyncMode && onAnimeSelect) {
      onAnimeSelect(null);
    }
  };

  const handleSelect = (item: Anime) => {
    if (isAsyncMode) {
      setSelectedAsyncAnime(item);
      setSearchTerm(item.title);
      onSelect?.(item);
      setIsOpen(false);
    } else {
      onAnimeSelect?.(item);
      setSearchTerm(item.title);
      setIsOpen(false);
    }
  };

  const clearSelection = () => {
    if (isAsyncMode) {
      setSelectedAsyncAnime(null);
      setSearchTerm('');
      onSelect?.(null as any);
    } else {
      onAnimeSelect?.(null);
      setSearchTerm('');
    }
    setIsOpen(false);
  };

  const currentSelectedAnime = isAsyncMode ? selectedAsyncAnime : selectedAnime;
  const isLoading = isAsyncMode ? asyncLoading : localLoading || false;

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={isAsyncMode ? placeholder : 'Type to search anime...'}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {currentSelectedAnime && (
          <button
            onClick={clearSelection}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-2"></div>
              Loading...
            </div>
          ) : asyncError ? (
            <div className="p-4 text-center text-red-400">{asyncError}</div>
          ) : filteredAnimes.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              {searchTerm ? 'No results found' : 'Type to search'}
            </div>
          ) : (
            filteredAnimes.map(anime => (
              <button
                key={anime._id || anime.id}
                onClick={() => handleSelect(anime)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                  currentSelectedAnime?._id === anime._id || currentSelectedAnime?.id === anime.id
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300'
                }`}
                type="button"
              >
                <div className="font-medium">{anime.title}</div>
                <div className="text-sm text-slate-400">
                  {anime.episodes?.length || 0} episodes • {anime.status || 'N/A'}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {currentSelectedAnime && !isOpen && (
        <div className="mt-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-white">{currentSelectedAnime.title}</h4>
              <p className="text-slate-300 text-sm">
                {currentSelectedAnime.episodes?.length || 0} episodes • {currentSelectedAnime.status || 'N/A'}
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-white transition-colors text-sm"
              type="button"
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